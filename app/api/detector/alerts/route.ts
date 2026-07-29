import { NextResponse } from "next/server";
import { blockMacOnRouter } from "@/lib/router/ssh-block";
import { blockIpsLocally } from "@/lib/network/local-firewall";
import {
  getDeviceByMac,
  getRouterConfig,
  insertAlert,
  markAlertBlocked,
} from "@/lib/db/queries";

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

  const alert = insertAlert({
    attack_type: body.attack_type,
    target_ip: body.target_ip,
    real_mac: body.real_mac,
    attacker_mac: body.attacker_mac,
  });

  const trusted = getDeviceByMac(body.attacker_mac);
  if (trusted?.is_trusted) {
    return NextResponse.json({
      alert,
      auto_blocked: false,
      skipped_reason: "attacker_mac is a trusted device",
    });
  }

  const config = getRouterConfig();
  let routerError: string | undefined;

  if (config.router_ip) {
    const result = await blockMacOnRouter(config, body.attacker_mac);
    if (result.success) {
      markAlertBlocked(alert.id, "router");
      return NextResponse.json({
        alert: { ...alert, status: "blocked" as const, block_method: "router" },
        auto_blocked: true,
        block_method: "router",
      });
    }
    routerError = result.error;
  }

  // Router blocking unavailable or failed (e.g. stock ISP/mesh routers like
  // Telkomsel Orbit don't expose SSH) — fall back to blocking the attacker's
  // IP(s) locally via Windows Firewall.
  const targetIps = body.target_ip.split(",").map((ip) => ip.trim());
  const localResult = await blockIpsLocally(targetIps);
  if (localResult.success) {
    markAlertBlocked(alert.id, "local_firewall");
    return NextResponse.json({
      alert: {
        ...alert,
        status: "blocked" as const,
        block_method: "local_firewall",
      },
      auto_blocked: true,
      block_method: "local_firewall",
    });
  }

  return NextResponse.json({
    alert,
    auto_blocked: false,
    skipped_reason: routerError
      ? `router: ${routerError}; local firewall: ${localResult.error}`
      : localResult.error,
  });
}
