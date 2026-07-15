import { getDashboardSnapshot } from "@/lib/db/queries";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const snapshot = getDashboardSnapshot();

  return (
    <DashboardClient
      initialActiveDeviceCount={snapshot.activeDeviceCount}
      initialTrustedDeviceCount={snapshot.trustedDeviceCount}
      initialRecentAlerts={snapshot.recentAlerts}
      initialUnhandledCount={snapshot.unhandledCount}
      initialBlockedCount={snapshot.blockedCount}
      initialTotalAlertCount={snapshot.totalAlertCount}
      initialLastHeartbeat={snapshot.lastHeartbeat}
    />
  );
}
