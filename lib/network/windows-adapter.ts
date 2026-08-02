import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NetworkAdapter } from "@/lib/types";

const execFileAsync = promisify(execFile);

export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// After restarting an adapter that happens to be the machine's active
// internet connection, give Windows time to reacquire a DHCP lease + DNS
// before the caller tries to reach anything over the network (e.g. Supabase).
const POST_RESTART_SETTLE_MS = 5000;

export async function runPowerShell(
  script: string,
  timeoutMs = 20_000
): Promise<string> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true, maxBuffer: 1024 * 1024, timeout: timeoutMs }
  );
  return stdout;
}

type RawAdapter = {
  Name: string;
  InterfaceDescription: string;
  MacAddress: string | null;
  Status: string;
};

export async function listNetworkAdapters(): Promise<NetworkAdapter[]> {
  const stdout = await runPowerShell(
    "Get-NetAdapter | Select-Object Name, InterfaceDescription, MacAddress, Status | ConvertTo-Json -Compress"
  );

  const trimmed = stdout.trim();
  if (!trimmed) return [];

  const parsed: RawAdapter | RawAdapter[] = JSON.parse(trimmed);
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((row) => ({
    name: row.Name,
    description: row.InterfaceDescription,
    macAddress: (row.MacAddress ?? "").replaceAll("-", ":"),
    status: row.Status,
  }));
}

export function generateLocallyAdministeredMac(): string {
  const bytes = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256)
  );
  // Set the locally-administered bit and clear the multicast bit on the
  // first octet, per IEEE 802 addressing rules for non-vendor-assigned MACs.
  bytes[0] = (bytes[0] & 0b11111100) | 0b00000010;
  return bytes
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":")
    .toUpperCase();
}

export type RotateResult = { success: true } | { success: false; error: string };

function toAdapterCommandError(err: unknown): RotateResult {
  const message = err instanceof Error ? err.message : String(err);

  if (/access is denied|requires elevation|administrator/i.test(message)) {
    return {
      success: false,
      error:
        "Access denied. Restart the server as Administrator to change adapter MAC addresses.",
    };
  }

  if (/no matching.*advancedproperty/i.test(message)) {
    return {
      success: false,
      error:
        "This adapter's driver does not support software MAC address overrides.",
    };
  }

  return { success: false, error: message };
}

/**
 * Clears any software MAC override, reverting the adapter back to its
 * real burned-in hardware address.
 */
export async function resetAdapterToHardwareMac(
  adapterName: string
): Promise<RotateResult> {
  const safeName = escapePowerShellSingleQuoted(adapterName);

  try {
    await runPowerShell(
      `Reset-NetAdapterAdvancedProperty -Name '${safeName}' -RegistryKeyword 'NetworkAddress'; ` +
        `Restart-NetAdapter -Name '${safeName}' -Confirm:$false`
    );
    await sleep(POST_RESTART_SETTLE_MS);
    return { success: true };
  } catch (err) {
    return toAdapterCommandError(err);
  }
}

export async function setAdapterMacAddress(
  adapterName: string,
  newMac: string
): Promise<RotateResult> {
  const safeName = escapePowerShellSingleQuoted(adapterName);
  const registryValue = newMac.replaceAll(":", "");

  try {
    await runPowerShell(
      `Set-NetAdapterAdvancedProperty -Name '${safeName}' -RegistryKeyword 'NetworkAddress' -RegistryValue '${registryValue}'; ` +
        `Restart-NetAdapter -Name '${safeName}' -Confirm:$false`
    );
    await sleep(POST_RESTART_SETTLE_MS);
    return { success: true };
  } catch (err) {
    return toAdapterCommandError(err);
  }
}
