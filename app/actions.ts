"use server";

import { revalidatePath } from "next/cache";
import { executeAlertBlock } from "@/lib/network/block-alert";
import { blockMacOnRouter } from "@/lib/router/ssh-block";
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

  const result = await executeAlertBlock(alert);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  markAlertBlocked(alertId, result.method);
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
  const detector_auto_start = formData.get("detector_auto_start") === "on";
  const detector_iface = String(formData.get("detector_iface") ?? "");

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
    detector_auto_start,
    detector_iface,
  });

  if (detector_auto_start) {
    const { getDetectorSupervisor } = await import("@/lib/detector/supervisor");
    getDetectorSupervisor().restart({ iface: detector_iface });
  }

  revalidatePath("/settings");
  return { success: true };
}
