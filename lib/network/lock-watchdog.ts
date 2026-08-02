import {
  insertMacRotationLog,
  listAdapterLocks,
  listGatewayLocks,
} from "@/lib/db/queries";
import {
  listNetworkAdapters,
  resetAdapterToHardwareMac,
} from "./windows-adapter";
import { getNeighborState, pinGatewayMac } from "./gateway-guard";
import { isSimulatedGatewayLock } from "./gateway-demo";
import type { AdapterLock, GatewayLock } from "@/lib/types";

const CHECK_INTERVAL_MS = 15_000;

let started = false;

/**
 * Periodically checks locked adapters against their real MAC and reverts
 * + logs if anything alters one. Runs while this Node.js server is alive.
 */
export function startAdapterLockWatchdog() {
  if (started) return;
  started = true;

  setInterval(() => {
    checkLockedAdapters().catch((err) => {
      console.error("[adapter-lock-watchdog] check failed:", err);
    });
    checkGatewayLocks().catch((err) => {
      console.error("[gateway-lock-watchdog] check failed:", err);
    });
  }, CHECK_INTERVAL_MS);

  console.log(
    `[adapter-lock-watchdog] started, checking every ${CHECK_INTERVAL_MS / 1000}s`
  );
}

async function checkLockedAdapters() {
  const locks = listAdapterLocks().filter((l: AdapterLock) => l.is_locked);
  if (locks.length === 0) return;

  const adapters = await listNetworkAdapters();

  for (const lock of locks) {
    const adapter = adapters.find((a) => a.name === lock.adapter_name);
    if (!adapter || !adapter.macAddress) continue;

    if (adapter.macAddress !== lock.locked_mac) {
      console.warn(
        `[adapter-lock-watchdog] Unauthorized MAC change on ${lock.adapter_name}: ` +
          `${adapter.macAddress} (expected ${lock.locked_mac}). Reverting...`
      );

      const previousMac = adapter.macAddress;
      const result = await resetAdapterToHardwareMac(
        lock.adapter_name,
        adapter.interfaceIndex
      );

      try {
        insertMacRotationLog({
          adapter_name: lock.adapter_name,
          previous_mac: previousMac,
          new_mac: lock.locked_mac,
          triggered_by: "lock_enforcement",
        });
      } catch (err) {
        console.error(
          `[adapter-lock-watchdog] Failed to log enforcement for ${lock.adapter_name}:`,
          err
        );
      }

      if (!result.success) {
        console.error(
          `[adapter-lock-watchdog] Failed to revert ${lock.adapter_name}:`,
          result.error
        );
      }
    }
  }
}

/**
 * Verifies each pinned gateway still resolves to its locked MAC. Windows
 * doesn't reliably keep reporting "Permanent" in Get-NetNeighbor's State
 * for a persistent entry once it's been used a while (it can show as
 * Reachable/Stale even though the persistent store entry is intact), so
 * only the MAC itself is checked — that's what actually matters. A missing
 * entry (no neighbor row at all) is re-applied silently since we can't
 * tell whether that's tampering or just a benign cache clear; a genuine
 * MAC mismatch is re-applied AND logged as an enforcement event.
 */
async function checkGatewayLocks() {
  const locks = listGatewayLocks().filter((l: GatewayLock) => l.is_locked);
  if (locks.length === 0) return;

  for (const lock of locks) {
    if (isSimulatedGatewayLock(lock.interface_alias)) {
      continue;
    }

    const neighbor = await getNeighborState(lock.gateway_ip);

    if (neighbor.mac === lock.locked_mac) continue;

    const wasTampered = neighbor.mac !== null;

    console.warn(
      wasTampered
        ? `[gateway-lock-watchdog] Unauthorized MAC change on gateway ${lock.gateway_ip}: ` +
            `${neighbor.mac} (expected ${lock.locked_mac}). Reverting...`
        : `[gateway-lock-watchdog] Gateway pin missing for ${lock.gateway_ip}. Re-applying...`
    );

    const result = await pinGatewayMac(
      lock.interface_alias,
      lock.gateway_ip,
      lock.locked_mac
    );

    if (wasTampered) {
      try {
        insertMacRotationLog({
          adapter_name: `Gateway ${lock.gateway_ip}`,
          previous_mac: neighbor.mac!,
          new_mac: lock.locked_mac,
          triggered_by: "lock_enforcement",
        });
      } catch (err) {
        console.error(
          `[gateway-lock-watchdog] Failed to log enforcement for ${lock.gateway_ip}:`,
          err
        );
      }
    }

    if (!result.success) {
      console.error(
        `[gateway-lock-watchdog] Failed to re-pin ${lock.gateway_ip}:`,
        result.error
      );
    }
  }
}
