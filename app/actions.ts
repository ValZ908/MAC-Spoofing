"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { blockMacOnRouter } from "@/lib/router/ssh-block";

type ActionResult = { success: true } | { success: false; error: string };

export async function trustDevice(deviceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("devices")
    .update({ is_trusted: true })
    .eq("id", deviceId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/devices");
  return { success: true };
}

export async function disconnectDevice(deviceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("devices")
    .update({ status: "disconnected" })
    .eq("id", deviceId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/devices");
  revalidatePath("/");
  return { success: true };
}

export async function blockAttacker(
  alertId: string,
  attackerMac: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: config, error: configError } = await supabase
    .from("router_config")
    .select("router_ip, username, password, block_command_template")
    .limit(1)
    .single();

  if (configError || !config) {
    return {
      success: false,
      error: "Router configuration not found. Set it up in Settings first.",
    };
  }

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

  const { error: updateError } = await supabase
    .from("alerts")
    .update({ status: "blocked" })
    .eq("id", alertId);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath("/alerts");
  revalidatePath("/");
  return { success: true };
}

export async function ignoreAlert(alertId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({ status: "ignored" })
    .eq("id", alertId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/alerts");
  revalidatePath("/");
  return { success: true };
}

export async function saveRouterConfig(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const router_ip = String(formData.get("router_ip") ?? "");
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const block_command_template = String(
    formData.get("block_command_template") ?? ""
  );
  const spoof_window_seconds = Number(
    formData.get("spoof_window_seconds") ?? 5
  );

  const { data: existing } = await supabase
    .from("router_config")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return { success: false, error: "Router configuration row not found." };
  }

  const { error } = await supabase
    .from("router_config")
    .update({
      router_ip,
      username,
      password,
      block_command_template,
      spoof_window_seconds,
    })
    .eq("id", existing.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true };
}
