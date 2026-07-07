import { createServiceClient } from "@/lib/supabase/service";
import { listNetworkAdapters, resetAdapterToHardwareMac } from "./windows-adapter";
import { withRetry } from "@/lib/retry";
import type { AdapterLock } from "@/lib/types";

const CHECK_INTERVAL_MS = 15_000;

let started = false;

/**
 * Periodically checks locked adapters against their real MAC and reverts
 * + logs an alert if anything (an attacker, malware, or an accidental
 * change) alters one. Runs only while this Node.js server process is alive.
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
  const supabase = createServiceClient();

  const { data: locks, error } = await supabase
    .from("adapter_locks")
    .select("*")
    .eq("is_locked", true);

  if (error || !locks || locks.length === 0) return;

  const adapters = await listNetworkAdapters();

  for (const lock of locks as AdapterLock[]) {
    const adapter = adapters.find((a) => a.name === lock.adapter_name);
    if (!adapter || !adapter.macAddress) continue;

    if (adapter.macAddress !== lock.locked_mac) {
      console.warn(
        `[adapter-lock-watchdog] Unauthorized MAC change on ${lock.adapter_name}: ` +
          `${adapter.macAddress} (expected ${lock.locked_mac}). Reverting...`
      );

      const previousMac = adapter.macAddress;
      const result = await resetAdapterToHardwareMac(lock.adapter_name);

      // Restarting the adapter can briefly cut the connection to Supabase
      // if it's the machine's active internet adapter, so retry the log
      // write while it reconnects instead of silently dropping the entry.
      try {
        await withRetry(
          () =>
            supabase.from("mac_rotation_log").insert({
              adapter_name: lock.adapter_name,
              previous_mac: previousMac,
              new_mac: lock.locked_mac,
              triggered_by: "lock_enforcement",
            }),
          6,
          3000
        );
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
