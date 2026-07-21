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

type RawRoute = {
  NextHop: string;
  InterfaceAlias: string;
};

/**
 * Finds the machine's current default gateway IP and the interface it's
 * reached through, then resolves the gateway's current MAC address (pinging
 * it first in case there's no existing ARP/neighbor entry yet).
 */
export async function getDefaultGateway(): Promise<GatewayInfo | null> {
  const routeStdout = await runPowerShell(
    "Get-NetRoute -DestinationPrefix '0.0.0.0/0' | " +
      "Sort-Object -Property RouteMetric | " +
      "Select-Object -First 1 NextHop, InterfaceAlias | ConvertTo-Json -Compress"
  );

  const trimmed = routeStdout.trim();
  if (!trimmed) return null;

  const route: RawRoute = JSON.parse(trimmed);
  if (!route?.NextHop) return null;

  const safeIp = escapePowerShellSingleQuoted(route.NextHop);
  const macStdout = await runPowerShell(
    `Test-Connection -ComputerName '${safeIp}' -Count 1 -Quiet -ErrorAction SilentlyContinue | Out-Null; ` +
      `Start-Sleep -Milliseconds 300; ` +
      `(Get-NetNeighbor -IPAddress '${safeIp}' -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.LinkLayerAddress -and $_.LinkLayerAddress -ne '00-00-00-00-00-00' } | ` +
      `Select-Object -First 1 -ExpandProperty LinkLayerAddress)`,
    10_000
  );

  const mac = macStdout.trim();

  return {
    ip: route.NextHop,
    interfaceAlias: route.InterfaceAlias,
    macAddress: mac ? mac.replaceAll("-", ":") : null,
  };
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
