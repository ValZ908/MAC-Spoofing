"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Fingerprint,
  Wifi,
  RefreshCw,
  Shuffle,
  Terminal,
  Trash2,
  AlertTriangle,
  Lock,
  Unlock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AdapterLock, MacRotationLogEntry, NetworkAdapter } from "@/lib/types";
import {
  getAdapters,
  lockAdapter,
  unlockAdapter,
  rotateAdapterMac,
  clearSecurityLog,
} from "./actions";

type Props = {
  initialLog: MacRotationLogEntry[];
  initialLocks: AdapterLock[];
};

export function IdentityClient({ initialLog, initialLocks }: Props) {
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [adaptersLoading, setAdaptersLoading] = useState(true);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [log, setLog] = useState(initialLog);
  const [locks, setLocks] = useState(initialLocks);
  const [lockingAdapter, setLockingAdapter] = useState<string | null>(null);
  const [rotatingAdapter, setRotatingAdapter] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [isClearingLog, setIsClearingLog] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("identity-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mac_rotation_log" },
        async () => {
          const { data } = await supabase
            .from("mac_rotation_log")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(20);
          setLog((data as MacRotationLogEntry[]) ?? []);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "adapter_locks" },
        async () => {
          const { data } = await supabase.from("adapter_locks").select("*");
          setLocks((data as AdapterLock[]) ?? []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function refreshAdapters() {
    const result = await getAdapters();
    if (result.success) {
      setAdapters(result.adapters);
      setAdapterError(null);
    } else {
      setAdapterError(result.error);
    }
    setAdaptersLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    getAdapters().then((result) => {
      if (cancelled) return;
      if (result.success) {
        setAdapters(result.adapters);
        setAdapterError(null);
      } else {
        setAdapterError(result.error);
      }
      setAdaptersLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLockToggle(adapter: NetworkAdapter, isLocked: boolean) {
    setLockError(null);
    setLockingAdapter(adapter.name);
    startTransition(async () => {
      const result = isLocked
        ? await unlockAdapter(adapter.name)
        : await lockAdapter(adapter.name);
      if (!result.success) {
        setLockError(result.error);
      } else {
        await refreshAdapters();
      }
      setLockingAdapter(null);
    });
  }

  function handleRotate(adapter: NetworkAdapter) {
    setRotateError(null);
    setRotatingAdapter(adapter.name);
    startTransition(async () => {
      const result = await rotateAdapterMac(adapter.name);
      if (!result.success) {
        setRotateError(result.error);
      } else {
        await refreshAdapters();
      }
      setRotatingAdapter(null);
    });
  }

  async function handleClearLog() {
    setIsClearingLog(true);
    const result = await clearSecurityLog();
    if (result.success) {
      setLog([]);
    }
    setIsClearingLog(false);
  }

  const lockedCount = locks.filter((l) => l.is_locked).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">
        Network Identity
      </h1>

      {/* Status card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-8 text-center backdrop-blur-xl">
        <div className="animate-scan absolute left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-white/60 to-transparent" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-white to-gray-300 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              <Fingerprint className="h-8 w-8 text-black" />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">
            {lockedCount > 0
              ? `${lockedCount} Adapter${lockedCount === 1 ? "" : "s"} Locked`
              : "No Adapters Locked"}
          </h2>
          <p className="text-sm text-gray-400">
            Locked adapters can&apos;t have their MAC address changed — any
            attempt is reverted automatically.
          </p>
        </div>
      </div>

      {adapterError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Couldn&apos;t read network adapters: {adapterError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Adapter list */}
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Active Adapters
            </h3>
            <button
              onClick={() => void refreshAdapters()}
              className="text-gray-500 transition hover:text-gray-300"
              aria-label="Refresh adapters"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {adapters.map((adapter) => {
              const lock = locks.find((l) => l.adapter_name === adapter.name);
              const isLocked = lock?.is_locked ?? false;

              return (
                <div
                  key={adapter.name}
                  className={`rounded-xl border p-3 ${
                    isLocked
                      ? "border-white/25 bg-white/[0.06]"
                      : "border-white/5 bg-white/5"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">
                        {adapter.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isLocked && (
                        <span className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          <Lock className="h-2.5 w-2.5" />
                          Locked
                        </span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          adapter.status === "Up"
                            ? "bg-white/10 text-gray-300"
                            : "bg-white/5 text-gray-400"
                        }`}
                      >
                        {adapter.status}
                      </span>
                    </div>
                  </div>
                  <p className="mb-3 font-mono text-xs text-gray-500">
                    {adapter.macAddress || "unknown"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={
                        rotatingAdapter === adapter.name ||
                        isLocked ||
                        isPending
                      }
                      onClick={() => handleRotate(adapter)}
                      title={
                        isLocked
                          ? "Unlock this adapter first to rotate its MAC"
                          : undefined
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white py-1.5 text-xs font-bold text-black transition hover:bg-zinc-200 disabled:opacity-50"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {rotatingAdapter === adapter.name
                        ? "Rotating…"
                        : "Rotate Now"}
                    </button>
                    <button
                      disabled={lockingAdapter === adapter.name || isPending}
                      onClick={() => handleLockToggle(adapter, isLocked)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                        isLocked
                          ? "border border-white/15 text-gray-300 hover:bg-white/5"
                          : "bg-emerald-700 text-white hover:bg-emerald-600"
                      }`}
                    >
                      {isLocked ? (
                        <Unlock className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {lockingAdapter === adapter.name
                        ? "…"
                        : isLocked
                        ? "Unlock"
                        : "Lock"}
                    </button>
                  </div>
                </div>
              );
            })}
            {adaptersLoading && (
              <p className="text-sm text-gray-500">Detecting adapters…</p>
            )}
            {!adaptersLoading && adapters.length === 0 && !adapterError && (
              <p className="text-sm text-gray-500">No adapters found.</p>
            )}
            {lockError && <p className="text-xs text-red-400">{lockError}</p>}
            {rotateError && (
              <p className="text-xs text-red-400">{rotateError}</p>
            )}
          </div>
        </div>

        {/* Security log */}
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Security Log
            </h3>
            <div className="flex items-center gap-3">
              {log.length > 0 && (
                <button
                  onClick={() => void handleClearLog()}
                  disabled={isClearingLog}
                  className="flex items-center gap-1 text-xs text-gray-500 transition hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isClearingLog ? "Clearing…" : "Clear"}
                </button>
              )}
              <Terminal className="h-4 w-4 text-gray-600" />
            </div>
          </div>
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {log.length === 0 && (
              <p className="text-sm text-gray-500">
                No tampering attempts caught yet.
              </p>
            )}
            {log.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex flex-col gap-1 pt-2 text-xs ${
                  index > 0 ? "border-t border-white/5" : ""
                }`}
              >
                <span className="font-mono text-gray-600">
                  {new Date(entry.created_at).toLocaleString("en-US")}
                  {entry.triggered_by === "lock_enforcement" && (
                    <span className="ml-2 text-red-400">
                      (unauthorized change reverted)
                    </span>
                  )}
                </span>
                <span className="font-mono text-gray-300">
                  {entry.adapter_name}: {entry.previous_mac} →{" "}
                  <span className="text-white">{entry.new_mac}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}