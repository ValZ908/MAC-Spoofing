"use server";

import { revalidatePath } from "next/cache";
import {
  listNetworkAdapters,
  generateLocallyAdministeredMac,
  setAdapterMacAddress,
} from "@/lib/network/windows-adapter";
import {
  isAdapterUp,
  isVirtualAdapter,
} from "@/lib/network/adapter-utils";
import {
  getDefaultGateway,
  pinGatewayMac,
  unpinGatewayMac,
} from "@/lib/network/gateway-guard";
import {
  buildSimulatedGateway,
  isSimulatedGatewayLock,
  SIMULATED_LOCK_PREFIX,
} from "@/lib/network/gateway-demo";
import {
  clearMacRotationLog,
  getAdapterLock,
  getGatewayLock,
  insertMacRotationLog,
  listAdapterLocks,
  listGatewayLocks,
  listMacRotationLog,
  setAdapterUnlocked,
  setGatewayUnlocked,
  upsertAdapterLock,
  upsertGatewayLock,
} from "@/lib/db/queries";
import type {
  AdapterLock,
  GatewayInfo,
  GatewayLock,
  MacRotationLogEntry,
  NetworkAdapter,
} from "@/lib/types";

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
  gatewayLocks: GatewayLock[];
}> {
  return {
    log: listMacRotationLog(20),
    locks: listAdapterLocks(),
    gatewayLocks: listGatewayLocks(),
  };
}

export async function getGatewayInfo(): Promise<
  { success: true; gateway: GatewayInfo } | { success: false; error: string }
> {
  try {
    const gateway = await getDefaultGateway();
    if (gateway) {
      return { success: true, gateway };
    }

    const adapters = await listNetworkAdapters();
    return { success: true, gateway: buildSimulatedGateway(adapters) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

async function resolveGatewayForPin(): Promise<GatewayInfo> {
  const live = await getDefaultGateway({ forceRefresh: true });
  if (live) {
    return live;
  }
  const adapters = await listNetworkAdapters();
  return buildSimulatedGateway(adapters);
}

export async function pinGateway(): Promise<ActionResult> {
  const gateway = await resolveGatewayForPin();

  if (gateway.simulated) {
    if (!gateway.macAddress) {
      return {
        success: false,
        error: "Gateway has no MAC address to pin.",
      };
    }

    upsertGatewayLock({
      gateway_ip: gateway.ip,
      interface_alias: `${SIMULATED_LOCK_PREFIX}${gateway.interfaceAlias}`,
      locked_mac: gateway.macAddress,
      is_locked: true,
    });

    revalidatePath("/identity");
    return { success: true };
  }

  if (!gateway.macAddress) {
    return {
      success: false,
      error:
        "Could not resolve the gateway's MAC address. Make sure you're connected to a network.",
    };
  }

  const result = await pinGatewayMac(
    gateway.interfaceAlias,
    gateway.ip,
    gateway.macAddress
  );
  if (!result.success) {
    return { success: false, error: result.error };
  }

  upsertGatewayLock({
    gateway_ip: gateway.ip,
    interface_alias: gateway.interfaceAlias,
    locked_mac: gateway.macAddress,
    is_locked: true,
  });

  revalidatePath("/identity");
  return { success: true };
}

export async function unpinGateway(gatewayIp: string): Promise<ActionResult> {
  const lock = getGatewayLock(gatewayIp);
  if (!lock) {
    return { success: false, error: "Gateway lock not found." };
  }

  if (!isSimulatedGatewayLock(lock.interface_alias)) {
    const result = await unpinGatewayMac(lock.interface_alias, gatewayIp);
    if (!result.success) {
      return { success: false, error: result.error };
    }
  }

  setGatewayUnlocked(gatewayIp);
  revalidatePath("/identity");
  return { success: true };
}

export async function lockAdapter(adapterName: string): Promise<ActionResult> {
  const adapters = await listNetworkAdapters();
  const target = adapters.find((a) => a.name === adapterName);
  if (!target) {
    return { success: false, error: "Adapter not found." };
  }
  if (!isAdapterUp(target.status)) {
    return {
      success: false,
      error: "Cannot lock a disconnected adapter. Lock the one with Status Up.",
    };
  }
  if (!target.macAddress) {
    return {
      success: false,
      error: "Adapter has no MAC address yet. Connect the network and retry.",
    };
  }

  upsertAdapterLock({
    adapter_name: adapterName,
    locked_mac: target.macAddress,
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
  if (!isAdapterUp(adapter.status)) {
    return {
      success: false,
      error: "Cannot rotate MAC on a disconnected adapter.",
    };
  }
  if (isVirtualAdapter(adapter)) {
    return {
      success: false,
      error:
        "This is a virtual adapter (e.g. Hyper-V / VPN). It cannot change MAC. Use WLAN or a physical Ethernet port.",
    };
  }

  const newMac = generateLocallyAdministeredMac();
  const result = await setAdapterMacAddress(
    adapterName,
    newMac,
    adapter.interfaceIndex
  );
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
