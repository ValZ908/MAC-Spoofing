"use server";

import { revalidatePath } from "next/cache";
import {
  listNetworkAdapters,
  resetAdapterToHardwareMac,
  generateLocallyAdministeredMac,
  setAdapterMacAddress,
} from "@/lib/network/windows-adapter";
import {
  clearMacRotationLog,
  getAdapterLock,
  insertMacRotationLog,
  listAdapterLocks,
  listMacRotationLog,
  setAdapterUnlocked,
  upsertAdapterLock,
} from "@/lib/db/queries";
import type { AdapterLock, MacRotationLogEntry, NetworkAdapter } from "@/lib/types";

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

export async function getIdentityData(): Promise<{
  log: MacRotationLogEntry[];
  locks: AdapterLock[];
}> {
  return {
    log: listMacRotationLog(20),
    locks: listAdapterLocks(),
  };
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

  upsertAdapterLock({
    adapter_name: adapterName,
    locked_mac: adapter.macAddress,
    is_locked: true,
  });

  revalidatePath("/identity");
  return { success: true };
}

export async function rotateAdapterMac(
  adapterName: string
): Promise<ActionResult> {
  const lock = getAdapterLock(adapterName);
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

  insertMacRotationLog({
    adapter_name: adapterName,
    previous_mac: adapter.macAddress,
    new_mac: newMac,
    triggered_by: "manual",
  });

  revalidatePath("/identity");
  return { success: true };
}

export async function clearSecurityLog(): Promise<ActionResult> {
  clearMacRotationLog();
  revalidatePath("/identity");
  return { success: true };
}

export async function unlockAdapter(
  adapterName: string
): Promise<ActionResult> {
  setAdapterUnlocked(adapterName);
  revalidatePath("/identity");
  return { success: true };
}
