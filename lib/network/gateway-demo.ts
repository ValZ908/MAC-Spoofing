import type { GatewayInfo, NetworkAdapter } from "@/lib/types";
import { isPhysicalAdapter, sortAdapters } from "./adapter-utils";

/** Demo router MAC — shown when live ARP lookup is unavailable. */
const DEMO_GATEWAY_MAC = "DC:2C:6E:7A:E4:BE";

/** Prefix stored in gateway_locks.interface_alias for demo pins (no netsh). */
export const SIMULATED_LOCK_PREFIX = "simulated:";

export function isSimulatedGatewayLock(interfaceAlias: string): boolean {
  return interfaceAlias.startsWith(SIMULATED_LOCK_PREFIX);
}

export function buildSimulatedGateway(
  adapters: NetworkAdapter[]
): GatewayInfo {
  const physical = sortAdapters(adapters).find(isPhysicalAdapter);
  const hostIp = physical?.name
    ? guessGatewayFromAdapterName(physical.name)
    : null;

  return {
    ip: hostIp ?? "10.10.0.1",
    interfaceAlias: physical?.name ?? "WLAN",
    macAddress: DEMO_GATEWAY_MAC,
    simulated: true,
  };
}

/** Best-effort: common campus / home-router default (.1 on same /24). */
function guessGatewayFromAdapterName(_adapterName: string): string | null {
  return "10.10.0.1";
}
