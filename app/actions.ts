"use server";

import { revalidatePath } from "next/cache";
import { blockMacOnRouter } from "@/lib/router/ssh-block";
import {
  getDeviceById,
  getRouterConfig,
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

export async function blockAttacker(
  alertId: string,
  attackerMac: string
): Promise<ActionResult> {
  const config = getRouterConfig();

  if (!config.router_ip) {
    return {
      success: false,
      error: "Router IP is not configured yet. Set it up in Settings first.",
    };
  }

  const result = await blockMacOnRouter(config, attackerMac);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  updateAlertStatus(alertId, "blocked");
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
    formData.get("spoof_window_seconds") ?? 2
  );
  const alert_cooldown_seconds = Number(
    formData.get("alert_cooldown_seconds") ?? 300
  );
  const min_poisoning_ips = Number(formData.get("min_poisoning_ips") ?? 3);

  updateRouterConfig({
    router_ip,
    username,
    password,
    block_command_template,
    spoof_window_seconds: Number.isFinite(spoof_window_seconds)
      ? spoof_window_seconds
      : 2,
    alert_cooldown_seconds: Number.isFinite(alert_cooldown_seconds)
      ? alert_cooldown_seconds
      : 300,
    min_poisoning_ips: Number.isFinite(min_poisoning_ips)
      ? min_poisoning_ips
      : 3,
  });

  revalidatePath("/settings");
  return { success: true };
}
