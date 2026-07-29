import { getDashboardSnapshot, listAlerts, listDevices } from "@/lib/db/queries";
import { LiveRefresh } from "@/components/live-refresh";
import { DashboardClient } from "./dashboard-client";
import type { Alert } from "@/lib/types";
import pkg from "@/package.json";

/** Formats a duration in seconds as e.g. "2d 14h 32m". */
function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

/**
 * Buckets alerts into the 24 hourly slots ending now, so the dashboard chart
 * reflects real alert activity instead of invented data (this app doesn't
 * track historical device counts, so we chart alert volume instead).
 */
function buildHourlyAlertCounts(alerts: Alert[]) {
  const now = new Date();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - (23 - i));
    return { start, count: 0 };
  });

  for (const alert of alerts) {
    const t = new Date(alert.created_at).getTime();
    for (const bucket of buckets) {
      const bucketEnd = bucket.start.getTime() + 60 * 60 * 1000;
      if (t >= bucket.start.getTime() && t < bucketEnd) {
        bucket.count += 1;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    label: b.start.toLocaleTimeString("en-US", { hour: "numeric" }),
    count: b.count,
  }));
}

export default async function DashboardPage() {
  const snapshot = getDashboardSnapshot();
  const allAlerts = listAlerts();
  const allDevices = listDevices();

  // Real, derived list — active devices nobody has marked as trusted yet.
  const attentionDevices = allDevices
    .filter((d) => d.status === "active" && !d.is_trusted)
    .slice(0, 5);

  const hourlyAlertCounts = buildHourlyAlertCounts(allAlerts);

  const uptimeSeconds = process.uptime();
  const monitoringSince = new Date(Date.now() - uptimeSeconds * 1000);

  return (
    <>
      <LiveRefresh />
      <DashboardClient
        initialActiveDeviceCount={snapshot.activeDeviceCount}
        initialTrustedDeviceCount={snapshot.trustedDeviceCount}
        initialRecentAlerts={snapshot.recentAlerts}
        initialUnhandledCount={snapshot.unhandledCount}
        initialBlockedCount={snapshot.blockedCount}
        initialTotalAlertCount={snapshot.totalAlertCount}
        initialLastHeartbeat={snapshot.lastHeartbeat}
        attentionDevices={attentionDevices}
        hourlyAlertCounts={hourlyAlertCounts}
        uptimeLabel={formatDuration(uptimeSeconds)}
        monitoringSinceLabel={monitoringSince.toLocaleString("en-US")}
        version={`v${pkg.version}`}
      />
    </>
  );
}
