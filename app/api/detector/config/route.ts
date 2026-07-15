import { NextResponse } from "next/server";
import { getRouterConfig } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  const config = getRouterConfig();
  return NextResponse.json({
    spoof_window_seconds: config.spoof_window_seconds,
    router_configured: Boolean(config.router_ip),
  });
}
