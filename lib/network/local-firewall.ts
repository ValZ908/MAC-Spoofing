import { runPowerShell } from "./windows-adapter";

export type BlockResult = { success: true } | { success: false; error: string };

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isValidIpv4(ip: string): boolean {
  const match = IPV4_RE.exec(ip);
  if (!match) return false;
  return match.slice(1).every((segment) => Number(segment) <= 255);
}

function shortenFirewallError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/access is denied|requires elevation|administrator/i.test(raw)) {
    return "Access denied — run npm run dev as Administrator for real firewall rules.";
  }

  const stderrIdx = raw.indexOf("stderr:");
  if (stderrIdx >= 0) {
    const snippet = raw.slice(stderrIdx + 7).trim().split(/\r?\n/)[0];
    if (snippet) return snippet.slice(0, 240);
  }

  if (raw.startsWith("Command failed:")) {
    return "Windows Firewall command failed.";
  }

  return raw.slice(0, 240);
}

function ruleAlreadyExists(message: string): boolean {
  return /already exists|已存在|duplicate|object already exists/i.test(message);
}

async function addNetshRule(
  name: string,
  direction: "in" | "out",
  ip: string
): Promise<BlockResult> {
  const script =
    `netsh advfirewall firewall add rule name='${name.replace(/'/g, "''")}' ` +
    `dir=${direction} action=block remoteip=${ip}`;

  try {
    await runPowerShell(script, 5_000);
    return { success: true };
  } catch (err) {
    const message = shortenFirewallError(err);
    if (ruleAlreadyExists(message)) {
      return { success: true };
    }
    return { success: false, error: message };
  }
}

async function blockOneIp(ip: string): Promise<BlockResult> {
  const inResult = await addNetshRule(`MacSpoof-Block-${ip}-In`, "in", ip);
  if (!inResult.success) return inResult;

  return addNetshRule(`MacSpoof-Block-${ip}-Out`, "out", ip);
}

/**
 * Block remote IPs on this machine via Windows Firewall (netsh).
 * Each IP is handled in a separate short command to avoid cmdline limits.
 */
export async function blockIpsLocally(ips: string[]): Promise<BlockResult> {
  const validIps = [
    ...new Set(ips.map((ip) => ip.trim()).filter(isValidIpv4)),
  ];

  if (validIps.length === 0) {
    return { success: false, error: "No valid IP address to block locally." };
  }

  for (const ip of validIps) {
    const result = await blockOneIp(ip);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}
