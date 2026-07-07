import { createClient } from "@/lib/supabase/server";
import type { Alert } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { AlertRowActions } from "./alert-row-actions";

export default async function AlertsPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (alerts as Alert[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-100">
        Security Alert Log
      </h1>

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Target IP</th>
              <th className="px-4 py-3 font-medium">Real MAC</th>
              <th className="px-4 py-3 font-medium">Attacker MAC</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {rows.map((alert) => (
              <tr
                key={alert.id}
                className="text-slate-200 transition hover:bg-slate-900/60"
              >
                <td className="px-4 py-3">
                  {new Date(alert.created_at).toLocaleString("en-US")}
                </td>
                <td className="px-4 py-3">{alert.target_ip}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {alert.real_mac}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-red-300">
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
                      ? "Blocked"
                      : "Ignored"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {alert.status === "unhandled" && (
                    <AlertRowActions alert={alert} />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
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
