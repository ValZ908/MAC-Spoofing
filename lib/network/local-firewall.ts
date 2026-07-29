import { runPowerShell, escapePowerShellSingleQuoted } from "./windows-adapter";

export type BlockResult = { success: true } | { success: false; error: string };

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isValidIpv4(ip: string): boolean {
  const match = IPV4_RE.exec(ip);
  if (!match) return false;
  return match.slice(1).every((segment) => Number(segment) <= 255);
}

/**
 * Fallback for routers that don't expose SSH (most stock ISP/mesh routers,
 * e.g. Telkomsel Orbit): instead of blocking the attacker on the router,
 * block it on this machine via Windows Firewall. Only protects this host,
 * not the whole network, but works regardless of router make/model.
 */
export async function blockIpsLocally(ips: string[]): Promise<BlockResult> {
  const validIps = [
    ...new Set(ips.map((ip) => ip.trim()).filter(isValidIpv4)),
  ];

  if (validIps.length === 0) {
    return { success: false, error: "No valid IP address to block locally." };
  }

  const script = validIps
    .map((ip) => {
      const safeIp = escapePowerShellSingleQuoted(ip);
      const inName = escapePowerShellSingleQuoted(`MacSpoof-Block-${ip}-In`);
      const outName = escapePowerShellSingleQuoted(`MacSpoof-Block-${ip}-Out`);
      return (
        `if (-not (Get-NetFirewallRule -DisplayName '${inName}' -ErrorAction SilentlyContinue)) { ` +
        `New-NetFirewallRule -DisplayName '${inName}' -Direction Inbound -RemoteAddress '${safeIp}' -Action Block | Out-Null }; ` +
        `if (-not (Get-NetFirewallRule -DisplayName '${outName}' -ErrorAction SilentlyContinue)) { ` +
        `New-NetFirewallRule -DisplayName '${outName}' -Direction Outbound -RemoteAddress '${safeIp}' -Action Block | Out-Null }`
      );
    })
    .join("; ");

  try {
    await runPowerShell(script);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/access is denied|requires elevation|administrator/i.test(message)) {
      return {
        success: false,
        error:
          "Access denied. Restart the dashboard as Administrator to block locally.",
      };
    }
    return { success: false, error: message };
  }
}
