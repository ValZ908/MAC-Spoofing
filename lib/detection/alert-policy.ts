import {
  findRecentDuplicateAlert,
  getDeviceByMac,
  getDetectionSettings,
  isGatewayIp,
  isGatewayMac,
} from "@/lib/db/queries";
import type { AttackType } from "@/lib/types";

export type AlertCandidate = {
  attack_type: AttackType;
  target_ip: string;
  real_mac: string;
  attacker_mac: string;
};

export type AlertDecision =
  | { accept: true }
  | { accept: false; reason: string };

function normalizeMac(mac: string): string {
  return mac.replaceAll("-", ":").toUpperCase();
}

export function evaluateAlert(candidate: AlertCandidate): AlertDecision {
  const settings = getDetectionSettings();
  const attackerMac = normalizeMac(candidate.attacker_mac);

  const trusted = getDeviceByMac(attackerMac);
  if (trusted?.is_trusted) {
    return { accept: false, reason: "attacker_mac is a trusted device" };
  }

  if (isGatewayMac(attackerMac)) {
    return { accept: false, reason: "attacker_mac matches pinned gateway" };
  }

  if (candidate.attack_type === "arp_poisoning") {
    const ips = candidate.target_ip.split(",").map((ip) => ip.trim());
    const nonGatewayIps = ips.filter((ip) => !isGatewayIp(ip));
    if (nonGatewayIps.length < settings.min_poisoning_ips) {
      return {
        accept: false,
        reason: `only ${nonGatewayIps.length} non-gateway IP(s); need ${settings.min_poisoning_ips}`,
      };
    }
  }

  const duplicate = findRecentDuplicateAlert(
    candidate.attack_type,
    attackerMac,
    candidate.target_ip,
    settings.alert_cooldown_seconds
  );
  if (duplicate) {
    return {
      accept: false,
      reason: `duplicate within ${settings.alert_cooldown_seconds}s cooldown`,
    };
  }

  return { accept: true };
}
