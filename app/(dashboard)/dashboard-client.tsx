"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Monitor,
  Bell,
  Ban,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Alert, DetectorHeartbeat, Device } from "@/lib/types";

type DashboardSnapshot = {
  activeDeviceCount: number;
  trustedDeviceCount: number;
  recentAlerts: Alert[];
  unhandledCount: number;
  blockedCount: number;
  totalAlertCount: number;
  lastHeartbeat: DetectorHeartbeat | null;
};

type HourlyPoint = { label: string; count: number };

type Props = {
  initialActiveDeviceCount: number;
  initialTrustedDeviceCount: number;
  initialRecentAlerts: Alert[];
  initialUnhandledCount: number;
  initialBlockedCount: number;
  initialTotalAlertCount: number;
  initialLastHeartbeat: DetectorHeartbeat | null;
  attentionDevices: Device[];
  hourlyAlertCounts: HourlyPoint[];
  uptimeLabel: string;
  monitoringSinceLabel: string;
  version: string;
};

const HEARTBEAT_STALE_MS = 25_000;

const badgeVariant: Record<Alert["status"], "success" | "danger" | "neutral"> = {
  unhandled: "danger",
  blocked: "success",
  ignored: "neutral",
};

/**
 * Alerts don't carry a stored severity in the schema — this derives a
 * reasonable label from the attack type so the table reads like the
 * reference design, without inventing data that isn't tracked.
 */
function severityFor(attackType: Alert["attack_type"]): {
  label: "High" | "Medium";
  variant: "danger" | "warning";
} {
  return attackType === "arp_poisoning"
    ? { label: "High", variant: "danger" }
    : { label: "Medium", variant: "warning" };
}

const attackLabel: Record<string, string> = {
  ip_mac_mismatch: "IP/MAC Mismatch",
  arp_poisoning: "ARP Spoofing",
};

function StatCard({
  icon: Icon,
  label,
  value,
  accentClassName,
  sublabel,
  sublabelClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accentClassName: string;
  sublabel: string;
  sublabelClassName?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-0.5 ${accentClassName}`} />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      <p className={`mt-1 text-xs font-medium ${sublabelClassName ?? "text-muted-foreground"}`}>
        {sublabel}
      </p>
    </div>
  );
}

/** Simple hand-rolled donut chart — no charting library required. */
function TrustDonut({ trusted, untrusted }: { trusted: number; untrusted: number }) {
  const total = trusted + untrusted;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const trustedRatio = total > 0 ? trusted / total : 0;
  const trustedLength = circumference * trustedRatio;

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
      <circle cx="80" cy="80" r={radius} fill="none" className="stroke-border" strokeWidth="18" />
      {total > 0 && (
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          className="stroke-emerald-500"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${trustedLength} ${circumference - trustedLength}`}
          strokeDashoffset={circumference * 0.25}
          transform="rotate(-90 80 80)"
        />
      )}
      <text x="80" y="76" textAnchor="middle" className="fill-foreground text-2xl font-bold">
        {total}
      </text>
      <text x="80" y="98" textAnchor="middle" className="fill-muted-foreground text-xs">
        Total
      </text>
    </svg>
  );
}

/** Simple hand-rolled area chart for hourly alert volume — no charting library required. */
function AlertsAreaChart({ data }: { data: HourlyPoint[] }) {
  const width = 600;
  const height = 160;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((d, i) => ({
    x: i * stepX,
    y: height - (d.count / max) * (height - 16) - 8,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const labelIndices = [0, 4, 8, 12, 16, 20, 23].filter((i) => i < data.length);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between py-1 text-xs text-muted-foreground">
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-40 w-full">
          <path d={areaPath} className="fill-emerald-500/10" />
          <path d={linePath} fill="none" className="stroke-emerald-500" strokeWidth="2" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-emerald-500" />
          ))}
        </svg>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          {labelIndices.map((i) => (
            <span key={i}>{data[i]?.label}</span>
          ))}
        </div>
      </div>
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
  attentionDevices,
  hourlyAlertCounts,
  uptimeLabel,
  monitoringSinceLabel,
}: Props) {
  const [activeDeviceCount, setActiveDeviceCount] = useState(initialActiveDeviceCount);
  const [trustedDeviceCount, setTrustedDeviceCount] = useState(initialTrustedDeviceCount);
  const [recentAlerts, setRecentAlerts] = useState(initialRecentAlerts);
  const [unhandledCount, setUnhandledCount] = useState(initialUnhandledCount);
  const [blockedCount, setBlockedCount] = useState(initialBlockedCount);
  const [totalAlertCount, setTotalAlertCount] = useState(initialTotalAlertCount);
  const [lastHeartbeat, setLastHeartbeat] = useState(initialLastHeartbeat);

  // These two are intentionally `null` until the component mounts on the
  // client. Computing a real Date()/Date.now() during the initial render
  // would produce a different value on the server than on the client
  // (they run a few ms apart), which triggers a React hydration mismatch.
  // Starting both as `null` guarantees the server-rendered HTML and the
  // first client render are identical; the real values are filled in a
  // moment later inside useEffect, safely after hydration.
  const [now, setNow] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(tick);
  }, []);

  async function refresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as DashboardSnapshot;
        setActiveDeviceCount(data.activeDeviceCount);
        setTrustedDeviceCount(data.trustedDeviceCount);
        setRecentAlerts(data.recentAlerts);
        setUnhandledCount(data.unhandledCount);
        setBlockedCount(data.blockedCount);
        setTotalAlertCount(data.totalAlertCount);
        setLastHeartbeat(data.lastHeartbeat);
        setLastUpdated(new Date());
      }
    } catch {
      // Keep last known snapshot if the server briefly restarts.
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    // Also grabs the first real snapshot right after mount.
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  const isDanger = unhandledCount > 0;
  const unknownDeviceCount = Math.max(activeDeviceCount - trustedDeviceCount, 0);
  const trustRatio =
    activeDeviceCount > 0 ? Math.round((trustedDeviceCount / activeDeviceCount) * 100) : 0;

  const secondsSinceHeartbeat =
    lastHeartbeat && now !== null
      ? Math.round((now - new Date(lastHeartbeat.last_seen).getTime()) / 1000)
      : null;
  const isDetectorOnline =
    lastHeartbeat !== null &&
    now !== null &&
    now - new Date(lastHeartbeat.last_seen).getTime() < HEARTBEAT_STALE_MS;

  const bannerState: "danger" | "warning" | "secure" = isDanger
    ? "danger"
    : isDetectorOnline
      ? "secure"
      : "warning";

  const bannerCopy = {
    danger: {
      title: "Attack Detected",
      titleClass: "text-foreground font-bold",
      subtitle: `${unhandledCount} unhandled alert${unhandledCount === 1 ? "" : "s"} need review`,
      subtitleClass: "text-foreground",
      cardClass: "border-foreground bg-foreground/5",
      accentClass: "bg-foreground",
      iconClass: "text-foreground",
      icon: ShieldAlert,
    },
    warning: {
      title: "Monitoring Offline",
      titleClass: "text-muted-foreground font-bold",
      subtitle: lastHeartbeat
        ? `Detector agent hasn't reported in ${secondsSinceHeartbeat ?? "…"}s — network state unknown`
        : "Detector agent has never reported in — is detector.py running?",
      subtitleClass: "text-muted-foreground",
      cardClass: "border-border bg-card",
      accentClass: "bg-muted-foreground",
      iconClass: "text-muted-foreground",
      icon: ShieldQuestion,
    },
    secure: {
      title: "Secure",
      titleClass: "text-emerald-400",
      subtitle: "No active threats detected. Your network is being monitored.",
      subtitleClass: "text-muted-foreground",
      cardClass: "border-border bg-card",
      accentClass: "bg-emerald-500",
      iconClass: "text-emerald-400",
      icon: ShieldCheck,
    },
  }[bannerState];

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your network security status
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString("en-US") : "—"}
        </button>
      </div>

      {/* Status banner */}
      <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6 ${bannerCopy.cardClass}`}>
        <span className={`absolute inset-y-0 left-0 w-0.5 ${bannerCopy.accentClass}`} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <bannerCopy.icon className={`h-5 w-5 shrink-0 ${bannerCopy.iconClass}`} />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Network Status: <span className={bannerCopy.titleClass}>{bannerCopy.title}</span>
              </h2>
              <p className={`text-sm ${bannerCopy.subtitleClass}`}>{bannerCopy.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-6 sm:gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-sm font-semibold text-foreground">{uptimeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monitoring Since</p>
              <p className="text-sm font-semibold text-foreground">{monitoringSinceLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Monitor}
          label="Active Devices"
          value={activeDeviceCount}
          accentClassName="bg-border"
          sublabel="Currently online"
        />
        <StatCard
          icon={ShieldCheck}
          label="Trusted Devices"
          value={trustedDeviceCount}
          accentClassName="bg-emerald-500"
          sublabel={`${trustRatio}% of active devices`}
        />
        <StatCard
          icon={Bell}
          label="Unhandled Alerts"
          value={unhandledCount}
          accentClassName={unhandledCount > 0 ? "bg-foreground" : "bg-border"}
          sublabel={unhandledCount > 0 ? "Requires attention" : "All clear"}
          sublabelClassName={unhandledCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}
        />
        <StatCard
          icon={Ban}
          label="Blocked Attacks"
          value={blockedCount}
          accentClassName="bg-border"
          sublabel="Total blocked to date"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Recent Alerts</h3>
              <Link
                href="/alerts"
                className="flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                View all alerts <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Time</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium">Severity</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentAlerts.map((alert) => {
                      const severity = severityFor(alert.attack_type);
                      return (
                        <tr key={alert.id}>
                          <td className="py-2.5 text-foreground">
                            {new Date(alert.created_at).toLocaleTimeString("en-US")}
                          </td>
                          <td className="py-2.5 text-foreground">
                            {attackLabel[alert.attack_type] ?? alert.attack_type}
                          </td>
                          <td className="py-2.5 text-muted-foreground">{alert.target_ip}</td>
                          <td className="py-2.5">
                            <Badge variant={severity.variant}>{severity.label}</Badge>
                          </td>
                          <td className="py-2.5">
                            <Badge variant={badgeVariant[alert.status]}>{alert.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Alerts (Last 24 Hours)</h3>
              <span className="text-xs text-muted-foreground">Auto-refreshes with the page</span>
            </div>
            <AlertsAreaChart data={hourlyAlertCounts} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h3 className="mb-4 text-sm font-bold text-foreground">Device Trust Summary</h3>
            {activeDeviceCount === 0 ? (
              <p className="text-sm text-muted-foreground">No active devices yet.</p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <TrustDonut trusted={trustedDeviceCount} untrusted={unknownDeviceCount} />
                <div className="w-full space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      Trusted
                    </span>
                    <span className="text-muted-foreground">
                      {trustedDeviceCount} ({trustRatio}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-foreground">
                      <span className="h-2.5 w-2.5 rounded-full bg-border" />
                      Untrusted
                    </span>
                    <span className="text-muted-foreground">
                      {unknownDeviceCount} ({100 - trustRatio}%)
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reflects currently active devices only.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Devices Needing Attention</h3>
              <Link
                href="/devices"
                className="flex items-center gap-1 text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {attentionDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All active devices are trusted.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {attentionDevices.map((device) => (
                  <li
                    key={device.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {device.ip_address ?? "Unknown IP"}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {device.mac_address}
                      </p>
                    </div>
                    <Badge variant="warning">Untrusted</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Total alerts logged: {totalAlertCount}</span>
      </div>
    </div>
  );
}
