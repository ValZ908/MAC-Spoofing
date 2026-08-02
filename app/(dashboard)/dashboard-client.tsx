"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert,
  ShieldQuestion,
  ShieldCheck,
  Wifi,
  Bell,
  Lock,
  Ban,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelEyebrow } from "@/components/ui/panel";
import { SignalRing } from "@/components/ui/signal-ring";
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
  tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: "neutral" | "danger";
}) {
  return (
    <Panel
      tone={tone === "danger" ? "danger" : "signal"}
      bracketOpacity={tone === "danger" ? 0.7 : 0.25}
      className="flex flex-col justify-between p-4 sm:p-6"
    >
      <div className="mb-4 flex items-center gap-2 text-[hsl(var(--text-dim))] sm:mb-6">
        <Icon className="h-4 w-4" />
        <PanelEyebrow>{label}</PanelEyebrow>
      </div>
      <span
        className={`font-display text-2xl font-semibold tracking-tight sm:text-4xl ${
          tone === "danger" ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--text))]"
        }`}
      >
        {value}
      </span>
    </Panel>
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

    const run = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    const interval = setInterval(run, 8_000);
    document.addEventListener("visibilitychange", run);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", run);
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

  const ringState = bannerState === "secure" ? "secure" : bannerState === "danger" ? "danger" : "warning";

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <Panel
        tone={bannerState === "danger" ? "danger" : bannerState === "warning" ? "warn" : "signal"}
        bracketOpacity={0.6}
        className="flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7"
      >
        <SignalRing
          state={ringState}
          icon={
            bannerState === "danger" ? (
              <ShieldAlert className="h-7 w-7" />
            ) : bannerState === "warning" ? (
              <ShieldQuestion className="h-7 w-7" />
            ) : (
              <ShieldCheck className="h-7 w-7" />
            )
          }
        />
        <div>
          <PanelEyebrow className="mb-1.5">Network status</PanelEyebrow>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[hsl(var(--text))]">
            {bannerState === "danger"
              ? "Attack detected"
              : bannerState === "warning"
                ? "Monitoring offline"
                : "Secure"}
          </h1>
          <p
            className={`mt-1 font-mono text-sm tracking-wide ${
              bannerState === "danger"
                ? "text-[hsl(var(--danger))]"
                : bannerState === "warning"
                  ? "text-[hsl(var(--warn))]"
                  : "text-[hsl(var(--text-muted))]"
            }`}
          >
            {bannerState === "danger" &&
              `${unhandledCount} unhandled alert${unhandledCount === 1 ? "" : "s"}`}
            {bannerState === "warning" &&
              (lastHeartbeat
                ? `Detector agent hasn't reported in ${secondsSinceHeartbeat}s — network state unknown`
                : "Detector has never reported in — check Settings → Built-in Detector")}
            {bannerState === "secure" &&
              lastEventAt &&
              `Last event: ${new Date(lastEventAt).toLocaleString("en-US")}`}
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Wifi} label="Active Devices" value={activeDeviceCount} />
        <StatCard icon={Lock} label="Trusted Devices" value={trustedDeviceCount} />
        <StatCard
          icon={ShieldAlert}
          label="Unhandled Alerts"
          value={unhandledCount}
          tone={unhandledCount > 0 ? "danger" : "neutral"}
        />
        <StatCard icon={Ban} label="Blocked Attacks" value={blockedCount} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        <Panel tone="signal" bracketOpacity={0.25} className="flex flex-col p-5 sm:p-8 lg:col-span-7">
          <div className="mb-6 flex items-center gap-3 text-[hsl(var(--text-dim))] sm:mb-8">
            <Bell className="h-4 w-4" />
            <PanelEyebrow>Recent Alerts</PanelEyebrow>
          </div>

          {recentAlerts.length === 0 ? (
            <p className="font-mono text-sm text-[hsl(var(--text-dim))]">No alerts yet.</p>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-2 border-b border-[hsl(var(--line))] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="font-mono text-sm text-[hsl(var(--text-muted))]">
                    {new Date(alert.created_at).toLocaleString("en-US")}
                    <span className="mx-3 text-[hsl(var(--text-dim))]">→</span>
                    <span className="text-[hsl(var(--text))]">{alert.target_ip}</span>
                  </div>
                  <Badge variant={badgeVariant[alert.status]} className="w-fit">
                    {alert.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          tone="secure"
          bracketOpacity={0.25}
          className="flex min-h-[260px] flex-col p-5 sm:min-h-[300px] sm:p-8 lg:col-span-5"
        >
          <div className="mb-6 flex items-center gap-3 text-[hsl(var(--text-dim))] sm:mb-8">
            <ShieldCheck className="h-4 w-4" />
            <PanelEyebrow>Device Trust</PanelEyebrow>
          </div>

          <div className="mb-6 flex items-center justify-between border border-[hsl(var(--line))] bg-[hsl(var(--surface-2))] p-4">
            <span className="flex items-center gap-2 font-mono text-sm text-[hsl(var(--text-muted))]">
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
            <p className="font-mono text-sm text-[hsl(var(--text-dim))]">No active devices yet.</p>
          ) : (
            <div className="flex flex-1 flex-col justify-center gap-5">
              <div>
                <div className="mb-2 flex items-baseline justify-between font-mono text-sm">
                  <span className="text-[hsl(var(--text-muted))]">Trusted</span>
                  <span className="font-semibold text-[hsl(var(--text))]">
                    {trustedDeviceCount} / {activeDeviceCount}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--secure))] transition-all"
                    style={{ width: `${trustRatio}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border border-[hsl(var(--line))] bg-[hsl(var(--surface-2))] p-4 font-mono text-sm">
                <span className="text-[hsl(var(--text-muted))]">Unknown devices</span>
                <span className="font-semibold text-[hsl(var(--text))]">
                  {unknownDeviceCount}
                </span>
              </div>

              <div className="flex items-center justify-between border border-[hsl(var(--line))] bg-[hsl(var(--surface-2))] p-4 font-mono text-sm">
                <span className="text-[hsl(var(--text-muted))]">Total alerts logged</span>
                <span className="font-semibold text-[hsl(var(--text-muted))]">
                  {totalAlertCount}
                </span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
