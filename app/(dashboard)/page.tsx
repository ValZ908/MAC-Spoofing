import { createClient } from "@/lib/supabase/server";
import type { Alert, DetectorHeartbeat } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: activeDeviceCount },
    { count: trustedDeviceCount },
    { data: recentAlerts },
    { count: unhandledCount },
    { count: blockedCount },
    { count: totalAlertCount },
    { data: heartbeats, error: heartbeatError },
  ] = await Promise.all([
    supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_trusted", true),
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
    // Table added in migration 0004. May not exist yet on every environment,
    // so treat any error here as "feature not enabled yet" rather than a hard failure.
    supabase
      .from("detector_heartbeat")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(1),
  ]);

  return (
    <DashboardClient
      initialActiveDeviceCount={activeDeviceCount ?? 0}
      initialTrustedDeviceCount={trustedDeviceCount ?? 0}
      initialRecentAlerts={(recentAlerts as Alert[]) ?? []}
      initialUnhandledCount={unhandledCount ?? 0}
      initialBlockedCount={blockedCount ?? 0}
      initialTotalAlertCount={totalAlertCount ?? 0}
      initialLastHeartbeat={((heartbeats as DetectorHeartbeat[]) ?? [])[0] ?? null}
      initialHeartbeatFeatureEnabled={!heartbeatError}
    />
  );
}