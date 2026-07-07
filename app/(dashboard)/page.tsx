import { createClient } from "@/lib/supabase/server";
import type { Alert } from "@/lib/types";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: activeDeviceCount }, { data: recentAlerts }, { count: unhandledCount }] =
    await Promise.all([
      supabase
        .from("devices")
        .select("*", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "unhandled"),
    ]);

  return (
    <DashboardClient
      initialActiveDeviceCount={activeDeviceCount ?? 0}
      initialRecentAlerts={(recentAlerts as Alert[]) ?? []}
      initialUnhandledCount={unhandledCount ?? 0}
    />
  );
}
