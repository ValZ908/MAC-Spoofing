import { listAlerts } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { AlertRowActions } from "./alert-row-actions";
import { LiveRefresh } from "@/components/live-refresh";

const attackLabel: Record<string, string> = {
  ip_mac_mismatch: "IP/MAC mismatch",
  arp_poisoning: "ARP poisoning",
};

export default async function AlertsPage() {
  const rows = listAlerts();

  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Security Alert Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every time an IP appeared to switch MAC addresses. Block confirmed attackers, or
          ignore ones you&apos;ve verified are false alarms (adapter changes, DHCP renewals, etc).
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Target IP</th>
              <th className="px-4 py-3 font-medium">Real MAC</th>
              <th className="px-4 py-3 font-medium">Attacker MAC</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((alert) => (
              <tr key={alert.id} className="text-foreground transition hover:bg-muted">
                <td className="px-4 py-3">
                  {new Date(alert.created_at).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {attackLabel[alert.attack_type] ?? alert.attack_type}
                </td>
                <td className="px-4 py-3">{alert.target_ip}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {alert.real_mac}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-red-600">
                  {alert.attacker_mac}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      alert.status === "unhandled"
                        ? "danger"
                        : alert.status === "blocked"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {alert.status === "unhandled"
                      ? "Unhandled"
                      : alert.status === "blocked"
                        ? alert.block_method === "local_firewall"
                          ? "Blocked (Local Firewall)"
                          : alert.block_method === "router"
                            ? "Blocked (Router)"
                            : "Blocked"
                        : "Ignored"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {alert.status === "unhandled" && <AlertRowActions alert={alert} />}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No alerts recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
