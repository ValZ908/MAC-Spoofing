import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NetworkAdapter } from "@/lib/types";
import { isAdapterUp, isVirtualAdapter } from "./adapter-utils";

export { isAdapterUp, isVirtualAdapter };

const execFileAsync = promisify(execFile);

export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

/** Pass UTF-8 text into PowerShell without console code-page corruption. */
export function utf8ToPowerShellBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

/** Run PS, return JSON via Base64 UTF-8 (safe for Chinese adapter names). */
export async function runPowerShellJson<T>(
  script: string,
  timeoutMs = 20_000
): Promise<T> {
  const wrapped =
    `$ErrorActionPreference = 'Stop'; ` +
    `(${script}) | ConvertTo-Json -Compress -Depth 6 | ` +
    `ForEach-Object { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_)) }`;

  const stdout = await runPowerShell(wrapped, timeoutMs);
  const b64 = stdout.trim();
  if (!b64) {
    throw new Error("PowerShell returned empty JSON.");
  }

  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as T;
}

function adapterNameVar(psVar: string, adapterName: string): string {
  const b64 = utf8ToPowerShellBase64(adapterName);
  return (
    `${psVar} = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}'))`
  );
}

type RawAdapter = {
  Name: string;
  InterfaceDescription: string;
  MacAddress: string | null;
  Status: string;
  InterfaceIndex: number;
};

export async function listNetworkAdapters(): Promise<NetworkAdapter[]> {
  const parsed = await runPowerShellJson<RawAdapter | RawAdapter[]>(
    `Get-NetAdapter | Select-Object Name, InterfaceDescription, MacAddress, Status, InterfaceIndex`
  );

  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((row) => ({
    name: row.Name,
    description: row.InterfaceDescription,
    macAddress: (row.MacAddress ?? "").replaceAll("-", ":"),
    status: row.Status,
    interfaceIndex: row.InterfaceIndex,
  }));
}

export function generateLocallyAdministeredMac(): string {
  const bytes = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256)
  );
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
        "This Wi-Fi/Ethernet driver does not support changing MAC in software. Try Lock instead of Rotate.",
    };
  }

  if (
    /objectnotfound|notfound_name|cannot find/i.test(message) ||
    /NamedParameterNotFound/i.test(message)
  ) {
    return {
      success: false,
      error:
        "Could not reach the adapter. Restart npm run dev as Administrator, refresh, then retry on WLAN.",
    };
  }

  return { success: false, error: message };
}

function adapterByIndexScript(
  interfaceIndex: number,
  body: string
): string {
  return (
    `$if = Get-NetAdapter -InterfaceIndex ${interfaceIndex} -ErrorAction Stop; ` +
    body
  );
}

export async function resetAdapterToHardwareMac(
  adapterName: string,
  interfaceIndex?: number
): Promise<RotateResult> {
  const script = interfaceIndex
    ? adapterByIndexScript(
        interfaceIndex,
        `Reset-NetAdapterAdvancedProperty -Name $if.Name -RegistryKeyword 'NetworkAddress' -ErrorAction SilentlyContinue; ` +
          `Restart-NetAdapter -Name $if.Name -Confirm:$false`
      )
    : `${adapterNameVar("$adapterName", adapterName)}; ` +
      `Reset-NetAdapterAdvancedProperty -Name $adapterName -RegistryKeyword 'NetworkAddress' -ErrorAction SilentlyContinue; ` +
      `Restart-NetAdapter -Name $adapterName -Confirm:$false`;

  try {
    await runPowerShell(script, 30_000);
    await sleep(POST_RESTART_SETTLE_MS);
    return { success: true };
  } catch (err) {
    return toAdapterCommandError(err);
  }
}

export async function setAdapterMacAddress(
  adapterName: string,
  newMac: string,
  interfaceIndex?: number
): Promise<RotateResult> {
  const registryValue = newMac.replaceAll(":", "");
  const script = interfaceIndex
    ? adapterByIndexScript(
        interfaceIndex,
        `Set-NetAdapterAdvancedProperty -Name $if.Name -RegistryKeyword 'NetworkAddress' -RegistryValue '${registryValue}'; ` +
          `Restart-NetAdapter -Name $if.Name -Confirm:$false`
      )
    : `${adapterNameVar("$adapterName", adapterName)}; ` +
      `Set-NetAdapterAdvancedProperty -Name $adapterName -RegistryKeyword 'NetworkAddress' -RegistryValue '${registryValue}'; ` +
      `Restart-NetAdapter -Name $adapterName -Confirm:$false`;

  try {
    await runPowerShell(script, 30_000);
    await sleep(POST_RESTART_SETTLE_MS);
    return { success: true };
  } catch (err) {
    return toAdapterCommandError(err);
  }
}
