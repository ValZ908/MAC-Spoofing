import { NextResponse } from "next/server";
import { evaluateAlert } from "@/lib/detection/alert-policy";
import { insertAlert } from "@/lib/db/queries";
import type { AttackType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: {
    attack_type?: string;
    target_ip?: string;
    real_mac?: string;
    attacker_mac?: string;
  };

  try {
    const raw = await request.text();
    if (!raw) {
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 }
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

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

  return NextResponse.json({
    alert,
    auto_blocked: false,
  });
}
