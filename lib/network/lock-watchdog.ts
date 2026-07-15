import {
  insertMacRotationLog,
  listAdapterLocks,
} from "@/lib/db/queries";
import {
  listNetworkAdapters,
  resetAdapterToHardwareMac,
} from "./windows-adapter";
import type { AdapterLock } from "@/lib/types";

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
      const result = await resetAdapterToHardwareMac(lock.adapter_name);

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
