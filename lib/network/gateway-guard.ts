import {
  runPowerShell,
  escapePowerShellSingleQuoted,
} from "./windows-adapter";
import type { GatewayInfo } from "@/lib/types";

export type GatewayCommandResult =
  | { success: true }
  | { success: false; error: string };

function toGatewayCommandError(err: unknown): GatewayCommandResult {
  const message = err instanceof Error ? err.message : String(err);

  if (/access is denied|requires elevation|administrator/i.test(message)) {
    return {
      success: false,
      error:
        "Access denied. Restart the server as Administrator to pin the gateway's MAC address.",
    };
  }

  return { success: false, error: message };
}

type RawGatewayResult = {
  NextHop: string;
  InterfaceAlias: string;
  Mac: string | null;
};

// Spawning powershell.exe is already the dominant cost, but on some machines
// the NetTCPIP module itself takes several seconds to import cold inside a
// fresh process — unavoidable per-call since each invocation is a brand new
// process. Cache the result briefly so repeat page visits (e.g. clicking
// back to Identity during a demo) come back instantly instead of re-paying
// that cost every time.
const GATEWAY_CACHE_TTL_MS = 20_000;
let gatewayCache: { data: GatewayInfo | null; expiresAt: number } | null = null;

/**
 * Finds the machine's current default gateway IP and the interface it's
 * reached through, then resolves the gateway's current MAC address. Runs as
 * a single PowerShell invocation (spawning powershell.exe is the slow part —
 * every extra call costs another cold-start), and only pings the gateway as
 * a last resort if there's no ARP/neighbor entry cached yet. Once the
 * gateway is pinned (permanent ARP entry), this fast path makes every later
 * load near-instant.
 *
 * Pass forceRefresh for security-sensitive callers (e.g. pinning) that must
 * act on current truth rather than a cached snapshot.
 */
export async function getDefaultGateway(
  options?: { forceRefresh?: boolean }
): Promise<GatewayInfo | null> {
  if (
    !options?.forceRefresh &&
    gatewayCache &&
    Date.now() < gatewayCache.expiresAt
  ) {
    return gatewayCache.data;
  }

  const stdout = await runPowerShell(
    `$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' | ` +
      `Sort-Object -Property RouteMetric | Select-Object -First 1 NextHop, InterfaceAlias; ` +
      `if (-not $route) { '{}'; exit }; ` +
      `$ip = $route.NextHop; ` +
      `$mac = (Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' } | ` +
      `Select-Object -First 1 -ExpandProperty LinkLayerAddress); ` +
      `if (-not $mac) { ` +
      `Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue | Out-Null; ` +
      `Start-Sleep -Milliseconds 300; ` +
      `$mac = (Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' } | ` +
      `Select-Object -First 1 -ExpandProperty LinkLayerAddress) }; ` +
      `[PSCustomObject]@{ NextHop = $ip; InterfaceAlias = $route.InterfaceAlias; Mac = $mac } | ConvertTo-Json -Compress`,
    10_000
  );

  const trimmed = stdout.trim();
  if (!trimmed) {
    gatewayCache = { data: null, expiresAt: Date.now() + GATEWAY_CACHE_TTL_MS };
    return null;
  }

  const result: RawGatewayResult = JSON.parse(trimmed);
  if (!result?.NextHop) {
    gatewayCache = { data: null, expiresAt: Date.now() + GATEWAY_CACHE_TTL_MS };
    return null;
  }

  const gateway: GatewayInfo = {
    ip: result.NextHop,
    interfaceAlias: result.InterfaceAlias,
    macAddress: result.Mac ? result.Mac.replaceAll("-", ":") : null,
  };
  gatewayCache = { data: gateway, expiresAt: Date.now() + GATEWAY_CACHE_TTL_MS };
  return gateway;
}

/**
 * Adds a static ("Permanent") ARP/neighbor entry for the gateway's IP, so
 * Windows will always use this MAC for it and ignore any ARP reply claiming
 * otherwise — the standard defense against ARP spoofing targeting the
 * gateway from this specific machine.
 */
export async function pinGatewayMac(
  interfaceAlias: string,
  ip: string,
  mac: string
): Promise<GatewayCommandResult> {
  const safeIface = escapePowerShellSingleQuoted(interfaceAlias);
  const safeIp = escapePowerShellSingleQuoted(ip);
  const safeMac = escapePowerShellSingleQuoted(mac.replaceAll(":", "-"));

  try {
    await runPowerShell(
      `netsh interface ipv4 set neighbors '${safeIface}' '${safeIp}' '${safeMac}' store=persistent`
    );
    return { success: true };
  } catch (err) {
    return toGatewayCommandError(err);
  }
}

export async function unpinGatewayMac(
  interfaceAlias: string,
  ip: string
): Promise<GatewayCommandResult> {
  const safeIface = escapePowerShellSingleQuoted(interfaceAlias);
  const safeIp = escapePowerShellSingleQuoted(ip);

  try {
    await runPowerShell(
      `netsh interface ipv4 delete neighbors '${safeIface}' '${safeIp}'`
    );
    return { success: true };
  } catch (err) {
    return toGatewayCommandError(err);
  }
}

/**
 * Reads back the current neighbor state for an IP, to verify a pin is still
 * in place ("Permanent") and hasn't been removed or overridden.
 */
export async function getNeighborState(
  ip: string
): Promise<{ mac: string | null; state: string | null }> {
  const safeIp = escapePowerShellSingleQuoted(ip);
  const stdout = await runPowerShell(
    `Get-NetNeighbor -IPAddress '${safeIp}' -ErrorAction SilentlyContinue | ` +
      `Select-Object -First 1 LinkLayerAddress, State | ConvertTo-Json -Compress`
  );

  const trimmed = stdout.trim();
  if (!trimmed) return { mac: null, state: null };

  const parsed = JSON.parse(trimmed) as {
    LinkLayerAddress?: string;
    State?: string;
  };

  return {
    mac: parsed.LinkLayerAddress
      ? parsed.LinkLayerAddress.replaceAll("-", ":")
      : null,
    state: parsed.State ?? null,
  };
}
