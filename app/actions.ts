"use server";

import { revalidatePath } from "next/cache";
import { blockMacOnRouter } from "@/lib/router/ssh-block";
import { blockIpsLocally } from "@/lib/network/local-firewall";
import {
  getAlertById,
  getDeviceById,
  getRouterConfig,
  markAlertBlocked,
  setDeviceStatus,
  setDeviceTrusted,
  updateAlertStatus,
  updateRouterConfig,
} from "@/lib/db/queries";

type ActionResult = { success: true } | { success: false; error: string };

export async function trustDevice(deviceId: string): Promise<ActionResult> {
  setDeviceTrusted(deviceId, true);
  revalidatePath("/devices");
  revalidatePath("/");
  return { success: true };
}

export async function disconnectDevice(deviceId: string): Promise<ActionResult> {
  const device = getDeviceById(deviceId);
  if (!device) {
    return { success: false, error: "Device not found." };
  }

  const config = getRouterConfig();
  if (!config.router_ip) {
    return {
      success: false,
      error: "Router IP is not configured yet. Set it up in Settings first.",
    };
  }

  const result = await blockMacOnRouter(config, device.mac_address);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  setDeviceStatus(deviceId, "disconnected");
  revalidatePath("/devices");
  revalidatePath("/");
  return { success: true };
}

export async function blockAttacker(alertId: string): Promise<ActionResult> {
  const alert = getAlertById(alertId);
  if (!alert) {
    return { success: false, error: "Alert not found." };
  }

  const config = getRouterConfig();
  let routerError: string | undefined;

  if (config.router_ip) {
    const result = await blockMacOnRouter(config, alert.attacker_mac);
    if (result.success) {
      markAlertBlocked(alertId, "router");
      revalidatePath("/alerts");
      revalidatePath("/");
      return { success: true };
    }
    routerError = result.error;
  }

  // Router blocking unavailable or failed (e.g. stock ISP/mesh routers like
  // Telkomsel Orbit don't expose SSH) — fall back to blocking the attacker's
  // IP locally via Windows Firewall. Only protects this machine, but works
  // regardless of router make/model.
  const targetIps = alert.target_ip.split(",").map((ip) => ip.trim());
  const localResult = await blockIpsLocally(targetIps);
  if (!localResult.success) {
    return {
      success: false,
      error: routerError
        ? `Router block failed (${routerError}); local firewall block also failed: ${localResult.error}`
        : localResult.error,
    };
  }

  markAlertBlocked(alertId, "local_firewall");
  revalidatePath("/alerts");
  revalidatePath("/");
  return { success: true };
}

export async function ignoreAlert(alertId: string): Promise<ActionResult> {
  updateAlertStatus(alertId, "ignored");
  revalidatePath("/alerts");
  revalidatePath("/");
  return { success: true };
}

export async function saveRouterConfig(
  formData: FormData
): Promise<ActionResult> {
  const router_ip = String(formData.get("router_ip") ?? "");
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const block_command_template = String(
    formData.get("block_command_template") ?? ""
  );
  const spoof_window_seconds = Number(
    formData.get("spoof_window_seconds") ?? 5
  );

  updateRouterConfig({
    router_ip,
    username,
    password,
    block_command_template,
    spoof_window_seconds: Number.isFinite(spoof_window_seconds)
      ? spoof_window_seconds
      : 5,
  });

  revalidatePath("/settings");
  return { success: true };
}
