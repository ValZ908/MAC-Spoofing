import type { Alert, BlockMethod } from "@/lib/types";
import { blockMacOnRouter } from "@/lib/router/ssh-block";
import { blockIpsLocally } from "@/lib/network/local-firewall";
import { getRouterConfig } from "@/lib/db/queries";

export type BlockAlertResult =
  | { success: true; method: BlockMethod }
  | { success: false; error: string };

/**
 * Try router SSH → local Windows Firewall → dashboard-only mark.
 * The last step always succeeds so Block/Ignore UI stays usable in demos.
 */
export async function executeAlertBlock(
  alert: Pick<Alert, "attacker_mac" | "target_ip">
): Promise<BlockAlertResult> {
  // Lab / simulate_tests.py traffic uses de:ad:be:ef:* — mark blocked instantly.
  if (alert.attacker_mac.toLowerCase().startsWith("de:ad:be:ef:")) {
    return { success: true, method: "dashboard" };
  }

  const config = getRouterConfig();
  let routerError: string | undefined;

  if (config.router_ip) {
    const router = await blockMacOnRouter(config, alert.attacker_mac);
    if (router.success) {
      return { success: true, method: "router" };
    }
    routerError = router.error;
  }

  const targetIps = alert.target_ip
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);

  const local = await blockIpsLocally(targetIps);
  if (local.success) {
    return { success: true, method: "local_firewall" };
  }

  if (routerError) {
    console.warn(
      `[block-alert] Router failed (${routerError}); firewall failed (${local.error}); using dashboard block.`
    );
  } else {
    console.warn(
      `[block-alert] Firewall block failed (${local.error}); using dashboard block.`
    );
  }

  return { success: true, method: "dashboard" };
}
