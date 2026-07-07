import { createClient } from "@/lib/supabase/server";
import type { AdapterLock, MacRotationLogEntry } from "@/lib/types";
import { IdentityClient } from "./identity-client";

export default async function IdentityPage() {
  const supabase = await createClient();

  // Note: the adapter list is intentionally NOT fetched here. It requires
  // spawning a PowerShell process (Get-NetAdapter), which has a slow cold
  // start (1-2s+) and would block this page's render on every navigation.
  // IdentityClient fetches it client-side on mount instead, so the page
  // itself loads instantly and the adapter list fills in a moment later.
  const [{ data: log }, { data: locks }] = await Promise.all([
    supabase
      .from("mac_rotation_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("adapter_locks").select("*"),
  ]);

  return (
    <IdentityClient
      initialLog={(log as MacRotationLogEntry[]) ?? []}
      initialLocks={(locks as AdapterLock[]) ?? []}
    />
  );
}
