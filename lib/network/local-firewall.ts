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

  // Two block calls can land for the same IP within milliseconds (a spoof
  // test/attack typically fires a mismatch alert in each direction). Create
  // with -ErrorAction Stop inside try/catch and swallow only "already
  // exists" races, so a concurrent call creating the same rule name doesn't
  // surface as a false failure — while real errors (e.g. access denied)
  // still propagate.
  const script = validIps
    .map((ip) => {
      const safeIp = escapePowerShellSingleQuoted(ip);
      const inName = escapePowerShellSingleQuoted(`MacSpoof-Block-${ip}-In`);
      const outName = escapePowerShellSingleQuoted(`MacSpoof-Block-${ip}-Out`);
      return (
        `if (-not (Get-NetFirewallRule -DisplayName '${inName}' -ErrorAction SilentlyContinue)) { ` +
        `try { New-NetFirewallRule -DisplayName '${inName}' -Direction Inbound -RemoteAddress '${safeIp}' -Action Block -ErrorAction Stop | Out-Null } ` +
        `catch { if ($_.Exception.Message -notmatch 'already exists') { throw } } }; ` +
        `if (-not (Get-NetFirewallRule -DisplayName '${outName}' -ErrorAction SilentlyContinue)) { ` +
        `try { New-NetFirewallRule -DisplayName '${outName}' -Direction Outbound -RemoteAddress '${safeIp}' -Action Block -ErrorAction Stop | Out-Null } ` +
        `catch { if ($_.Exception.Message -notmatch 'already exists') { throw } } }`
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
