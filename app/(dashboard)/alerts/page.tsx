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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Security Alert Log</h1>
        <p className="mt-1 text-sm text-gray-400">
          Every time an IP appeared to switch MAC addresses. Block confirmed attackers, or
          ignore ones you&apos;ve verified are false alarms (adapter changes, DHCP renewals, etc).
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-900 text-gray-400">
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
          <tbody className="divide-y divide-white/10 bg-zinc-900">
            {rows.map((alert) => (
              <tr key={alert.id} className="text-gray-300 transition hover:bg-white/10">
                <td className="px-4 py-3">
                  {new Date(alert.created_at).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {attackLabel[alert.attack_type] ?? alert.attack_type}
                </td>
                <td className="px-4 py-3">{alert.target_ip}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {alert.real_mac}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-red-400">
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
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
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
