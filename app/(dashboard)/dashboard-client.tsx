"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Wifi, Bell, Lock, Ban, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import type { Alert, DetectorHeartbeat } from "@/lib/types";

type Props = {
  initialActiveDeviceCount: number;
  initialTrustedDeviceCount: number;
  initialRecentAlerts: Alert[];
  initialUnhandledCount: number;
  initialBlockedCount: number;
  initialTotalAlertCount: number;
  initialLastHeartbeat: DetectorHeartbeat | null;
  initialHeartbeatFeatureEnabled: boolean;
};

// Detector sends a heartbeat every 10s (see detector.py). Anything older
// than 2.5x that interval is treated as offline.
const HEARTBEAT_STALE_MS = 25_000;

const badgeVariant: Record<Alert["status"], "success" | "danger" | "neutral"> = {
  unhandled: "danger",
  blocked: "success",
  ignored: "neutral",
};

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: "default" | "danger" | "success";
}) {
  const valueColor =
    tone === "danger"
      ? "text-red-400"
      : tone === "success"
        ? "text-white"
        : "text-white";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-zinc-800 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-gray-400 sm:mb-6">
        <Icon className="h-4 w-4" />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] sm:text-xs">{label}</h3>
      </div>
      <span className={`text-2xl font-bold tracking-tight sm:text-4xl ${valueColor}`}>{value}</span>
    </div>
  );
}

export function DashboardClient({
  initialActiveDeviceCount,
  initialTrustedDeviceCount,
  initialRecentAlerts,
  initialUnhandledCount,
  initialBlockedCount,
  initialTotalAlertCount,
  initialLastHeartbeat,
  initialHeartbeatFeatureEnabled,
}: Props) {
  const [activeDeviceCount, setActiveDeviceCount] = useState(initialActiveDeviceCount);
  const [trustedDeviceCount, setTrustedDeviceCount] = useState(initialTrustedDeviceCount);
  const [recentAlerts, setRecentAlerts] = useState(initialRecentAlerts);
  const [unhandledCount, setUnhandledCount] = useState(initialUnhandledCount);
  const [blockedCount, setBlockedCount] = useState(initialBlockedCount);
  const [totalAlertCount, setTotalAlertCount] = useState(initialTotalAlertCount);
  const [lastHeartbeat, setLastHeartbeat] = useState(initialLastHeartbeat);
  const [heartbeatFeatureEnabled] = useState(initialHeartbeatFeatureEnabled);
  const [now, setNow] = useState(() => Date.now());

  // Re-check heartbeat staleness periodically, even if no new realtime
  // event arrives (which is exactly what happens when the detector dies).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const refreshAlertStats = async () => {
      const [{ data: alerts }, { count: unhandled }, { count: blocked }, { count: total }] =
        await Promise.all([
          supabase
            .from("alerts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("alerts")
            .select("*", { count: "exact", head: true })
            .eq("status", "unhandled"),
          supabase
            .from("alerts")
            .select("*", { count: "exact", head: true })
            .eq("status", "blocked"),
          supabase.from("alerts").select("*", { count: "exact", head: true }),
        ]);
      setRecentAlerts((alerts as Alert[]) ?? []);
      setUnhandledCount(unhandled ?? 0);
      setBlockedCount(blocked ?? 0);
      setTotalAlertCount(total ?? 0);
    };

    const refreshDeviceStats = async () => {
      const [{ count: active }, { count: trusted }] = await Promise.all([
        supabase
          .from("devices")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("devices")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .eq("is_trusted", true),
      ]);
      setActiveDeviceCount(active ?? 0);
      setTrustedDeviceCount(trusted ?? 0);
    };

    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        refreshAlertStats
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        refreshDeviceStats
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "detector_heartbeat" },
        (payload) => setLastHeartbeat(payload.new as DetectorHeartbeat)
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[dashboard] realtime subscription issue:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isDanger = unhandledCount > 0;
  const unknownDeviceCount = Math.max(activeDeviceCount - trustedDeviceCount, 0);
  const trustRatio =
    activeDeviceCount > 0 ? Math.round((trustedDeviceCount / activeDeviceCount) * 100) : 0;
  const lastEventAt = recentAlerts[0]?.created_at;

  const secondsSinceHeartbeat = lastHeartbeat
    ? Math.round((now - new Date(lastHeartbeat.last_seen).getTime()) / 1000)
    : null;
  const isDetectorOnline =
    lastHeartbeat !== null && now - new Date(lastHeartbeat.last_seen).getTime() < HEARTBEAT_STALE_MS;

  // Priority: an active attack always wins. Otherwise, if the sniffer
  // itself is offline we genuinely don't know the network state, so we
  // can't honestly claim "Secure". Skip this downgrade entirely if the
  // heartbeat table isn't deployed yet (migration 0004 pending).
  const bannerState: "danger" | "warning" | "secure" = isDanger
    ? "danger"
    : !heartbeatFeatureEnabled || isDetectorOnline
      ? "secure"
      : "warning";

  return (
    <div className="flex flex-col gap-8">
      {/* Hero status banner */}
      <div
        className={`flex flex-col items-start gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 ${
          bannerState === "danger"
            ? "border-red-700/40 bg-gradient-to-b from-red-700/10 to-red-700/[0.02] shadow-[inset_0_0_50px_rgba(185,28,28,0.05)]"
            : bannerState === "warning"
              ? "border-amber-600/40 bg-gradient-to-b from-amber-600/10 to-amber-600/[0.02] shadow-[inset_0_0_50px_rgba(217,119,6,0.05)]"
              : "border-white/15 bg-gradient-to-b from-white/5 to-white/[0.01] shadow-[inset_0_0_50px_rgba(255,255,255,0.03)]"
        }`}
      >
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${
            bannerState === "danger"
              ? "border-red-500/20 bg-red-900/20"
              : bannerState === "warning"
                ? "border-amber-500/20 bg-amber-900/20"
                : "border-white/15 bg-white/5"
          }`}
        >
          {bannerState === "danger" ? (
            <ShieldAlert className="h-7 w-7 text-red-500" />
          ) : bannerState === "warning" ? (
            <ShieldQuestion className="h-7 w-7 text-amber-500" />
          ) : (
            <ShieldCheck className="h-7 w-7 text-white" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {bannerState === "danger"
              ? "Attack Detected"
              : bannerState === "warning"
                ? "Monitoring Offline"
                : "Secure"}
          </h1>
          <p
            className={`text-sm font-medium tracking-wide ${
              bannerState === "danger"
                ? "text-red-400"
                : bannerState === "warning"
                  ? "text-amber-400"
                  : "text-gray-400"
            }`}
          >
            {bannerState === "danger" &&
              `${unhandledCount} unhandled alert${unhandledCount === 1 ? "" : "s"}`}
            {bannerState === "warning" &&
              (lastHeartbeat
                ? `Detector agent hasn't reported in ${secondsSinceHeartbeat}s — network state unknown`
                : "Detector agent has never reported in — is detector.py running?")}
            {bannerState === "secure" &&
              lastEventAt &&
              `Last event: ${new Date(lastEventAt).toLocaleString("en-US")}`}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Wifi} label="Active Devices" value={activeDeviceCount} />
        <StatCard icon={Lock} label="Trusted Devices" value={trustedDeviceCount} />
        <StatCard
          icon={ShieldAlert}
          label="Unhandled Alerts"
          value={unhandledCount}
          tone={unhandledCount > 0 ? "danger" : "default"}
        />
        <StatCard icon={Ban} label="Blocked Attacks" value={blockedCount} />
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-12">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-zinc-800 p-5 sm:rounded-[32px] sm:p-10 lg:col-span-7">
          <div className="mb-6 flex items-center gap-3 text-gray-400 sm:mb-8">
            <Bell className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]">Recent Alerts</h3>
          </div>

          {recentAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">No alerts yet.</p>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="text-sm font-medium text-gray-300">
                    {new Date(alert.created_at).toLocaleString("en-US")}
                    <span className="mx-3 text-gray-500">→</span>
                    {alert.target_ip}
                  </div>
                  <Badge variant={badgeVariant[alert.status]} className="w-fit">
                    {alert.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-[260px] flex-col rounded-2xl border border-white/10 bg-zinc-800 p-5 sm:min-h-[300px] sm:rounded-[32px] sm:p-10 lg:col-span-5">
          <div className="mb-6 flex items-center gap-3 text-gray-400 sm:mb-8">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]">Device Trust</h3>
          </div>

          <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-800 p-4">
            <span className="flex items-center gap-2 text-sm text-gray-400">
              <Radio className="h-4 w-4" />
              Detector Agent
            </span>
            {heartbeatFeatureEnabled ? (
              <Badge variant={isDetectorOnline ? "success" : "danger"}>
                {isDetectorOnline
                  ? "Online"
                  : lastHeartbeat
                    ? `Offline (${secondsSinceHeartbeat}s ago)`
                    : "Never seen"}
              </Badge>
            ) : (
              <Badge variant="neutral">Pending migration</Badge>
            )}
          </div>

          {activeDeviceCount === 0 ? (
            <p className="text-sm text-slate-500">No active devices yet.</p>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-6">
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm text-gray-400">Trusted</span>
                  <span className="text-sm font-semibold text-white">
                    {trustedDeviceCount} / {activeDeviceCount}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${trustRatio}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-800 p-4">
                <span className="text-sm text-gray-400">Unknown devices</span>
                <span className="text-sm font-semibold text-white">
                  {unknownDeviceCount}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-800 p-4">
                <span className="text-sm text-gray-400">Total alerts logged</span>
                <span className="text-sm font-semibold text-gray-300">{totalAlertCount}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}