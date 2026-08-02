"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Ban, EyeOff } from "lucide-react";
import { blockAttacker, ignoreAlert } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@/lib/types";

const attackLabel: Record<string, string> = {
  ip_mac_mismatch: "IP/MAC mismatch",
  arp_poisoning: "ARP poisoning",
};

function statusLabel(alert: Alert): string {
  if (alert.status === "unhandled") return "Unhandled";
  if (alert.status === "ignored") return "Ignored";
  if (alert.block_method === "local_firewall") return "Blocked (Local Firewall)";
  if (alert.block_method === "router") return "Blocked (Router)";
  if (alert.block_method === "dashboard") return "Blocked";
  return "Blocked";
}

export function AlertsClient({ initialAlerts }: { initialAlerts: Alert[] }) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const syncFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (res.ok) setAlerts((await res.json()) as Alert[]);
    } catch {
      /* keep snapshot */
    }
  }, []);

  useEffect(() => {
    setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void syncFromApi();
    };
    const id = setInterval(run, 12_000);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [syncFromApi]);

  function ignore(alert: Alert) {
    setAlerts((list) =>
      list.map((a) =>
        a.id === alert.id ? { ...a, status: "ignored" as const } : a
      )
    );
    setPendingId(alert.id);
    startTransition(async () => {
      await ignoreAlert(alert.id);
      setPendingId(null);
      void syncFromApi();
    });
  }

  function block(alert: Alert) {
    setPendingId(alert.id);
    setErrorById((e) => {
      const next = { ...e };
      delete next[alert.id];
      return next;
    });
    startTransition(async () => {
      const result = await blockAttacker(alert.id);
      setPendingId(null);
      if (!result.success) {
        setErrorById((e) => ({ ...e, [alert.id]: result.error }));
      }
      void syncFromApi();
    });
  }

  return (
    <div className="overflow-x-auto border border-[hsl(var(--line))]">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-[hsl(var(--line))] bg-[hsl(var(--surface-1))] font-mono text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--text-dim))]">
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
        <tbody className="divide-y divide-[hsl(var(--line))] bg-[hsl(var(--surface-1))]">
          {alerts.map((alert) => (
            <tr
              key={alert.id}
              className="text-[hsl(var(--text-muted))] transition-colors hover:bg-[hsl(var(--surface-2))]"
            >
              <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--text-muted))]">
                {new Date(alert.created_at).toLocaleString("en-US")}
              </td>
              <td className="px-4 py-3 text-xs">
                {attackLabel[alert.attack_type] ?? alert.attack_type}
              </td>
              <td className="px-4 py-3 font-mono text-[hsl(var(--text))]">{alert.target_ip}</td>
              <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--text-muted))]">
                {alert.real_mac}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--danger))]">
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
                  {statusLabel(alert)}
                </Badge>
              </td>
              <td className="px-4 py-3">
                {alert.status === "unhandled" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <button
                        disabled={pendingId === alert.id}
                        onClick={() => block(alert)}
                        className="inline-flex items-center gap-1 rounded-sm bg-[hsl(var(--danger))] px-3 py-1 font-mono text-xs font-medium text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Block
                      </button>
                      <button
                        disabled={pendingId === alert.id}
                        onClick={() => ignore(alert)}
                        className="inline-flex items-center gap-1 rounded-sm border border-[hsl(var(--line-strong))] px-3 py-1 font-mono text-xs font-medium text-[hsl(var(--text-muted))] transition hover:bg-[hsl(var(--surface-2))] disabled:opacity-50"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        Ignore
                      </button>
                    </div>
                    {errorById[alert.id] && (
                      <span className="font-mono text-xs text-[hsl(var(--danger))]">
                        {errorById[alert.id]}
                      </span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center font-mono text-[hsl(var(--text-dim))]">
                No alerts recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
