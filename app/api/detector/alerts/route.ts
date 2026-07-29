import { NextResponse } from "next/server";
import { evaluateAlert } from "@/lib/detection/alert-policy";
import { blockMacOnRouter } from "@/lib/router/ssh-block";
import {
  getDeviceByMac,
  getRouterConfig,
  insertAlert,
  updateAlertStatus,
} from "@/lib/db/queries";
import type { AttackType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    attack_type?: string;
    target_ip?: string;
    real_mac?: string;
    attacker_mac?: string;
  };

  if (!body.attack_type || !body.target_ip || !body.real_mac || !body.attacker_mac) {
    return NextResponse.json(
      {
        error:
          "attack_type, target_ip, real_mac, and attacker_mac are required",
      },
      { status: 400 }
    );
  }

  const candidate = {
    attack_type: body.attack_type as AttackType,
    target_ip: body.target_ip,
    real_mac: body.real_mac,
    attacker_mac: body.attacker_mac,
  };

  const decision = evaluateAlert(candidate);
  if (!decision.accept) {
    return NextResponse.json({
      suppressed: true,
      reason: decision.reason,
      auto_blocked: false,
    });
  }

  const alert = insertAlert(candidate);

  const trusted = getDeviceByMac(body.attacker_mac);
  if (trusted?.is_trusted) {
    return NextResponse.json({
      alert,
      auto_blocked: false,
      skipped_reason: "attacker_mac is a trusted device",
    });
  }

  const config = getRouterConfig();
  if (!config.router_ip) {
    return NextResponse.json({
      alert,
      auto_blocked: false,
      skipped_reason: "router not configured",
    });
  }

  const result = await blockMacOnRouter(config, body.attacker_mac);
  if (result.success) {
    updateAlertStatus(alert.id, "blocked");
    return NextResponse.json({
      alert: { ...alert, status: "blocked" as const },
      auto_blocked: true,
    });
  }

  return NextResponse.json({
    alert,
    auto_blocked: false,
    skipped_reason: result.error,
  });
}
