import { NextResponse } from "next/server";
import { getDetectionSettings } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  const settings = getDetectionSettings();
  return NextResponse.json({
    spoof_window_seconds: settings.spoof_window_seconds,
    alert_cooldown_seconds: settings.alert_cooldown_seconds,
    min_poisoning_ips: settings.min_poisoning_ips,
    gateway_ips: settings.gateway_ips,
    gateway_macs: settings.gateway_macs,
    router_configured: settings.gateway_ips.length > 0,
  });
}
