"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listNetworkAdapters,
  resetAdapterToHardwareMac,
  generateLocallyAdministeredMac,
  setAdapterMacAddress,
} from "@/lib/network/windows-adapter";
import { withRetry } from "@/lib/retry";
import type { NetworkAdapter } from "@/lib/types";

type ActionResult = { success: true } | { success: false; error: string };

export async function getAdapters(): Promise<
  { success: true; adapters: NetworkAdapter[] } | { success: false; error: string }
> {
  try {
    const adapters = await listNetworkAdapters();
    return { success: true, adapters };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function lockAdapter(adapterName: string): Promise<ActionResult> {
  const resetResult = await resetAdapterToHardwareMac(adapterName);
  if (!resetResult.success) {
    return { success: false, error: resetResult.error };
  }

  const adapters = await listNetworkAdapters();
  const adapter = adapters.find((a) => a.name === adapterName);
  if (!adapter) {
    return { success: false, error: "Adapter not found after reset." };
  }

  const supabase = await createClient();

  // The adapter was just restarted, which can briefly cut the connection to
  // Supabase if it's the machine's active internet adapter. The MAC reset
  // itself (the part that matters) already succeeded above, so don't make
  // the user wait on or fail because of this bookkeeping write — save it in
  // the background with retries. The Identity page's Realtime subscription
  // picks up the "Locked" badge whenever it lands.
  void withRetry(
    () =>
      supabase.from("adapter_locks").upsert(
        {
          adapter_name: adapterName,
          locked_mac: adapter.macAddress,
          is_locked: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "adapter_name" }
      ),
    6,
    3000
  ).catch((err) => {
    console.error(`[identity] Failed to save lock for ${adapterName}:`, err);
  });

  revalidatePath("/identity");
  return { success: true };
}

export async function rotateAdapterMac(
  adapterName: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: lock } = await supabase
    .from("adapter_locks")
    .select("is_locked")
    .eq("adapter_name", adapterName)
    .maybeSingle();

  if (lock?.is_locked) {
    return {
      success: false,
      error:
        "This adapter's MAC address is locked. Unlock it first to rotate.",
    };
  }

  const adapters = await listNetworkAdapters();
  const adapter = adapters.find((a) => a.name === adapterName);
  if (!adapter) {
    return { success: false, error: "Adapter not found." };
  }

  const newMac = generateLocallyAdministeredMac();
  const result = await setAdapterMacAddress(adapterName, newMac);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Same reasoning as lockAdapter: the MAC change itself already succeeded
  // above, so don't fail the user-facing result on this bookkeeping write —
  // save it in the background with retries in case this was the machine's
  // active internet adapter and it's still reconnecting.
  void withRetry(
    () =>
      supabase.from("mac_rotation_log").insert({
        adapter_name: adapterName,
        previous_mac: adapter.macAddress,
        new_mac: newMac,
        triggered_by: "manual",
      }),
    6,
    3000
  ).catch((err) => {
    console.error(`[identity] Failed to log rotation for ${adapterName}:`, err);
  });

  revalidatePath("/identity");
  return { success: true };
}

export async function clearSecurityLog(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mac_rotation_log")
    .delete()
    .not("id", "is", null);

  if (error) return { success: false, error: error.message };

  revalidatePath("/identity");
  return { success: true };
}

export async function unlockAdapter(
  adapterName: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("adapter_locks")
    .update({ is_locked: false, updated_at: new Date().toISOString() })
    .eq("adapter_name", adapterName);

  if (error) return { success: false, error: error.message };

  revalidatePath("/identity");
  return { success: true };
}
