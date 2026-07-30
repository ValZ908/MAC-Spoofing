"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Wifi,
  Bell,
  Lock,
  Ban,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Alert, DetectorHeartbeat } from "@/lib/types";

type DashboardSnapshot = {
  activeDeviceCount: number;
  trustedDeviceCount: number;
  recentAlerts: Alert[];
  unhandledCount: number;
  blockedCount: number;
  totalAlertCount: number;
  lastHeartbeat: DetectorHeartbeat | null;
};

type Props = {
  initialActiveDeviceCount: number;
  initialTrustedDeviceCount: number;
  initialRecentAlerts: Alert[];
  initialUnhandledCount: number;
  initialBlockedCount: number;
  initialTotalAlertCount: number;
  initialLastHeartbeat: DetectorHeartbeat | null;
};

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
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] sm:text-xs">
          {label}
        </h3>
      </div>
      <span className={`text-2xl font-bold tracking-tight sm:text-4xl ${valueColor}`}>
        {value}
      </span>
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
}: Props) {
  const [activeDeviceCount, setActiveDeviceCount] = useState(initialActiveDeviceCount);
  const [trustedDeviceCount, setTrustedDeviceCount] = useState(initialTrustedDeviceCount);
  const [recentAlerts, setRecentAlerts] = useState(initialRecentAlerts);
  const [unhandledCount, setUnhandledCount] = useState(initialUnhandledCount);
  const [blockedCount, setBlockedCount] = useState(initialBlockedCount);
  const [totalAlertCount, setTotalAlertCount] = useState(initialTotalAlertCount);
  const [lastHeartbeat, setLastHeartbeat] = useState(initialLastHeartbeat);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as DashboardSnapshot;
        if (cancelled) return;
        setActiveDeviceCount(data.activeDeviceCount);
        setTrustedDeviceCount(data.trustedDeviceCount);
        setRecentAlerts(data.recentAlerts);
        setUnhandledCount(data.unhandledCount);
        setBlockedCount(data.blockedCount);
        setTotalAlertCount(data.totalAlertCount);
        setLastHeartbeat(data.lastHeartbeat);
      } catch {
        // Keep last known snapshot if the server briefly restarts.
      }
    }

    const interval = setInterval(() => {
      void refresh();
    }, 5_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isDanger = unhandledCount > 0;
  const unknownDeviceCount = Math.max(activeDeviceCount - trustedDeviceCount, 0);
  const trustRatio =
    activeDeviceCount > 0
      ? Math.round((trustedDeviceCount / activeDeviceCount) * 100)
      : 0;
  const lastEventAt = recentAlerts[0]?.created_at;

  const secondsSinceHeartbeat = lastHeartbeat
    ? Math.round((now - new Date(lastHeartbeat.last_seen).getTime()) / 1000)
    : null;
  const isDetectorOnline =
    lastHeartbeat !== null &&
    now - new Date(lastHeartbeat.last_seen).getTime() < HEARTBEAT_STALE_MS;

  const bannerState: "danger" | "warning" | "secure" = isDanger
    ? "danger"
    : isDetectorOnline
      ? "secure"
      : "warning";

  return (
    <div className="flex flex-col gap-8">
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

      <div className="grid grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-12">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-zinc-800 p-5 sm:rounded-[32px] sm:p-10 lg:col-span-7">
          <div className="mb-6 flex items-center gap-3 text-gray-400 sm:mb-8">
            <Bell className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]">
              Recent Alerts
            </h3>
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
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]">
              Device Trust
            </h3>
          </div>

          <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-800 p-4">
            <span className="flex items-center gap-2 text-sm text-gray-400">
              <Radio className="h-4 w-4" />
              Detector Agent
            </span>
            <Badge variant={isDetectorOnline ? "success" : "danger"}>
              {isDetectorOnline
                ? "Online"
                : lastHeartbeat
                  ? `Offline (${secondsSinceHeartbeat}s ago)`
                  : "Never seen"}
            </Badge>
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
                <span className="text-sm font-semibold text-gray-300">
                  {totalAlertCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
