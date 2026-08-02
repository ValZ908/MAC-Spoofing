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
  ShieldCheck,
  Router,
} from "lucide-react";
import { Panel, PanelEyebrow } from "@/components/ui/panel";
import type {
  AdapterLock,
  GatewayInfo,
  GatewayLock,
  MacRotationLogEntry,
  NetworkAdapter,
} from "@/lib/types";
import {
  getAdapters,
  getIdentityData,
  getGatewayInfo,
  lockAdapter,
  unlockAdapter,
  rotateAdapterMac,
  pinGateway,
  unpinGateway,
  clearSecurityLog,
} from "./actions";

type Props = {
  initialLog: MacRotationLogEntry[];
  initialLocks: AdapterLock[];
  initialGatewayLocks: GatewayLock[];
};

export function IdentityClient({
  initialLog,
  initialLocks,
  initialGatewayLocks,
}: Props) {
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [adaptersLoading, setAdaptersLoading] = useState(true);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [log, setLog] = useState(initialLog);
  const [locks, setLocks] = useState(initialLocks);
  const [gatewayLocks, setGatewayLocks] = useState(initialGatewayLocks);
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [gatewayInfoLoading, setGatewayInfoLoading] = useState(true);
  const [gatewayInfoError, setGatewayInfoError] = useState<string | null>(
    null
  );
  const [pinningGateway, setPinningGateway] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [lockingAdapter, setLockingAdapter] = useState<string | null>(null);
  const [rotatingAdapter, setRotatingAdapter] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [isClearingLog, setIsClearingLog] = useState(false);
  const [isPending, startTransition] = useTransition();

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

  async function refreshIdentityData() {
    const data = await getIdentityData();
    setLog(data.log);
    setLocks(data.locks);
    setGatewayLocks(data.gatewayLocks);
  }

  async function refreshGatewayInfo() {
    const result = await getGatewayInfo();
    if (result.success) {
      setGatewayInfo(result.gateway);
      setGatewayInfoError(null);
    } else {
      setGatewayInfoError(result.error);
    }
    setGatewayInfoLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    getAdapters()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setAdapters(result.adapters);
          setAdapterError(null);
        } else {
          setAdapterError(result.error);
        }
        setAdaptersLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setAdapterError(err instanceof Error ? err.message : String(err));
        setAdaptersLoading(false);
      });

    getGatewayInfo()
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setGatewayInfo(result.gateway);
          setGatewayInfoError(null);
        } else {
          setGatewayInfoError(result.error);
        }
        setGatewayInfoLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setGatewayInfoError(err instanceof Error ? err.message : String(err));
        setGatewayInfoLoading(false);
      });

    const interval = setInterval(() => {
      void refreshIdentityData();
    }, 2_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
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
        await Promise.all([refreshAdapters(), refreshIdentityData()]);
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
        await Promise.all([refreshAdapters(), refreshIdentityData()]);
      }
      setRotatingAdapter(null);
    });
  }

  function handlePinToggle(isLocked: boolean) {
    setPinError(null);
    setPinningGateway(true);
    startTransition(async () => {
      const result =
        isLocked && gatewayInfo
          ? await unpinGateway(gatewayInfo.ip)
          : await pinGateway();
      if (!result.success) {
        setPinError(result.error);
      } else {
        await Promise.all([refreshGatewayInfo(), refreshIdentityData()]);
      }
      setPinningGateway(false);
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
      <div>
        <PanelEyebrow className="mb-1.5">04 / Identity</PanelEyebrow>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[hsl(var(--text))] sm:text-3xl">
          Network Identity
        </h1>
      </div>

      <Panel tone="signal" bracketOpacity={0.45} className="relative overflow-hidden p-8 text-center">
        <div className="animate-scan absolute left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-[hsl(var(--signal)/0.7)] to-transparent" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-[hsl(var(--signal)/0.3)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--signal))] shadow-[0_0_30px_hsl(var(--signal)/0.35)]">
              <Fingerprint className="h-8 w-8 text-[hsl(var(--primary-foreground))]" />
            </div>
          </div>
          <h2 className="mb-2 font-display text-xl font-semibold text-[hsl(var(--text))]">
            {lockedCount > 0
              ? `${lockedCount} Adapter${lockedCount === 1 ? "" : "s"} Locked`
              : "No Adapters Locked"}
          </h2>
          <p className="max-w-md font-mono text-sm text-[hsl(var(--text-muted))]">
            Locked adapters can&apos;t have their MAC address changed — any
            attempt is reverted automatically.
          </p>
        </div>
      </Panel>

      {adapterError && (
        <div className="flex items-center gap-2 border border-[hsl(var(--warn)/0.3)] bg-[hsl(var(--warn)/0.08)] px-4 py-3 font-mono text-sm text-[hsl(var(--warn))]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Couldn&apos;t read network adapters: {adapterError}
        </div>
      )}

      {/* Gateway protection */}
      <Panel tone="signal" bracketOpacity={0.25} className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[hsl(var(--text-dim))]" />
          <PanelEyebrow>Gateway Protection</PanelEyebrow>
        </div>

        {gatewayInfoLoading && (
          <p className="font-mono text-sm text-[hsl(var(--text-muted))]">Detecting gateway…</p>
        )}

        {gatewayInfoError && !gatewayInfoLoading && (
          <p className="font-mono text-sm text-[hsl(var(--warn))]">{gatewayInfoError}</p>
        )}

        {gatewayInfo && !gatewayInfoLoading && (
          (() => {
            const gwLock = gatewayLocks.find(
              (l) => l.gateway_ip === gatewayInfo.ip
            );
            const isPinned = gwLock?.is_locked ?? false;

            return (
              <div
                className={`border p-3 ${
                  isPinned
                    ? "border-[hsl(var(--secure)/0.4)] bg-[hsl(var(--secure)/0.06)]"
                    : "border-[hsl(var(--line))] bg-[hsl(var(--surface-2))]"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Router className="h-4 w-4 text-[hsl(var(--text-dim))]" />
                    <span className="font-mono text-sm font-medium text-[hsl(var(--text))]">
                      {gatewayInfo.ip}
                    </span>
                    <span className="font-mono text-xs text-[hsl(var(--text-dim))]">
                      via {gatewayInfo.interfaceAlias}
                    </span>
                  </div>
                  {isPinned && (
                    <span className="flex items-center gap-1 rounded-sm bg-[hsl(var(--secure)/0.15)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[hsl(var(--secure))]">
                      <Lock className="h-2.5 w-2.5" />
                      Pinned
                    </span>
                  )}
                </div>
                <p className="mb-3 font-mono text-xs text-[hsl(var(--text-muted))]">
                  {gatewayInfo.macAddress ?? "unresolved"}
                  {isPinned &&
                    gwLock &&
                    gatewayInfo.macAddress &&
                    gwLock.locked_mac !== gatewayInfo.macAddress && (
                      <span className="ml-2 text-[hsl(var(--danger))]">
                        (should be {gwLock.locked_mac}!)
                      </span>
                    )}
                </p>
                <button
                  disabled={
                    pinningGateway ||
                    isPending ||
                    (!isPinned && !gatewayInfo.macAddress)
                  }
                  onClick={() => handlePinToggle(isPinned)}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 font-mono text-xs font-bold transition disabled:opacity-50 ${
                    isPinned
                      ? "border border-[hsl(var(--line-strong))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]"
                      : "bg-[hsl(var(--secure))] text-[hsl(var(--primary-foreground))] hover:brightness-110"
                  }`}
                >
                  {isPinned ? (
                    <Unlock className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                  {pinningGateway
                    ? "Working…"
                    : isPinned
                      ? "Unpin"
                      : "Pin Gateway MAC"}
                </button>
              </div>
            );
          })()
        )}

        <p className="mt-3 font-mono text-xs text-[hsl(var(--text-dim))]">
          Pinning the gateway makes this machine reject any ARP reply that
          tries to claim a different MAC for it — the standard defense
          against ARP spoofing aimed at your router.
        </p>

        {pinError && <p className="mt-2 font-mono text-xs text-[hsl(var(--danger))]">{pinError}</p>}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel tone="signal" bracketOpacity={0.25} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <PanelEyebrow>Active Adapters</PanelEyebrow>
            <button
              onClick={() => void refreshAdapters()}
              className="text-[hsl(var(--text-dim))] transition hover:text-[hsl(var(--text-muted))]"
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
                  className={`border p-3 ${
                    isLocked
                      ? "border-[hsl(var(--secure)/0.4)] bg-[hsl(var(--secure)/0.06)]"
                      : "border-[hsl(var(--line))] bg-[hsl(var(--surface-2))]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-[hsl(var(--text-dim))]" />
                      <span className="font-mono text-sm font-medium text-[hsl(var(--text))]">
                        {adapter.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isLocked && (
                        <span className="flex items-center gap-1 rounded-sm bg-[hsl(var(--secure)/0.15)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[hsl(var(--secure))]">
                          <Lock className="h-2.5 w-2.5" />
                          Locked
                        </span>
                      )}
                      <span
                        className={`rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          adapter.status === "Up"
                            ? "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-muted))]"
                            : "bg-[hsl(var(--surface-3))] text-[hsl(var(--text-dim))]"
                        }`}
                      >
                        {adapter.status}
                      </span>
                    </div>
                  </div>
                  <p className="mb-3 font-mono text-xs text-[hsl(var(--text-muted))]">
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
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-[hsl(var(--signal))] py-1.5 font-mono text-xs font-bold text-[hsl(var(--primary-foreground))] transition-all hover:tracking-wider hover:brightness-110 disabled:opacity-50"
                    >
                      <Shuffle className="h-3.5 w-3.5" />
                      {rotatingAdapter === adapter.name
                        ? "Rotating…"
                        : "Rotate Now"}
                    </button>
                    <button
                      disabled={lockingAdapter === adapter.name || isPending}
                      onClick={() => handleLockToggle(adapter, isLocked)}
                      className={`flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 font-mono text-xs font-bold transition disabled:opacity-50 ${
                        isLocked
                          ? "border border-[hsl(var(--line-strong))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))]"
                          : "bg-[hsl(var(--secure))] text-[hsl(var(--primary-foreground))] hover:brightness-110"
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
              <p className="font-mono text-sm text-[hsl(var(--text-muted))]">Detecting adapters…</p>
            )}
            {!adaptersLoading && adapters.length === 0 && !adapterError && (
              <p className="font-mono text-sm text-[hsl(var(--text-muted))]">No adapters found.</p>
            )}
            {lockError && <p className="font-mono text-xs text-[hsl(var(--danger))]">{lockError}</p>}
            {rotateError && (
              <p className="font-mono text-xs text-[hsl(var(--danger))]">{rotateError}</p>
            )}
          </div>
        </Panel>

        <Panel tone="signal" bracketOpacity={0.25} className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <PanelEyebrow>Security Log</PanelEyebrow>
            <div className="flex items-center gap-3">
              {log.length > 0 && (
                <button
                  onClick={() => void handleClearLog()}
                  disabled={isClearingLog}
                  className="flex items-center gap-1 font-mono text-xs text-[hsl(var(--text-dim))] transition hover:text-[hsl(var(--danger))] disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isClearingLog ? "Clearing…" : "Clear"}
                </button>
              )}
              <Terminal className="h-4 w-4 text-[hsl(var(--text-dim))]" />
            </div>
          </div>
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {log.length === 0 && (
              <p className="font-mono text-sm text-[hsl(var(--text-muted))]">
                No tampering attempts caught yet.
              </p>
            )}
            {log.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex flex-col gap-1 pt-2 text-xs ${
                  index > 0 ? "border-t border-[hsl(var(--line))]" : ""
                }`}
              >
                <span className="font-mono text-[hsl(var(--text-dim))]">
                  {new Date(entry.created_at).toLocaleString("en-US")}
                  {entry.triggered_by === "lock_enforcement" && (
                    <span className="ml-2 text-[hsl(var(--danger))]">
                      (unauthorized change reverted)
                    </span>
                  )}
                </span>
                <span className="font-mono text-[hsl(var(--text-muted))]">
                  {entry.adapter_name}: {entry.previous_mac} →{" "}
                  <span className="text-[hsl(var(--text))]">{entry.new_mac}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
