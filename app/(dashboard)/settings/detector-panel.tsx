"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Play, RotateCcw, Square, Radio } from "lucide-react";

type DetectorControlStatus = {
  state: "stopped" | "starting" | "running" | "crashed";
  pid: number | null;
  lastError: string | null;
  log: string[];
  iface: string | null;
  heartbeatOnline: boolean;
};

const stateLabel: Record<DetectorControlStatus["state"], string> = {
  stopped: "Stopped",
  starting: "Starting…",
  running: "Running",
  crashed: "Crashed",
};

const stateColor: Record<DetectorControlStatus["state"], string> = {
  stopped: "text-gray-400",
  starting: "text-amber-400",
  running: "text-emerald-400",
  crashed: "text-red-400",
};

export function DetectorPanel({
  initialAutoStart,
  initialIface,
}: {
  initialAutoStart: boolean;
  initialIface: string;
}) {
  const [autoStart, setAutoStart] = useState(initialAutoStart);
  const [iface, setIface] = useState(initialIface);
  const [status, setStatus] = useState<DetectorControlStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/detector/control", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as DetectorControlStatus);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refreshStatus();
    }, 4_000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  function runAction(action: "start" | "stop" | "restart") {
    startTransition(async () => {
      await fetch("/api/detector/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, iface: iface.trim() || undefined }),
      });
      await refreshStatus();
    });
  }

  const processState = status?.state ?? "stopped";
  const heartbeatOnline = status?.heartbeatOnline ?? false;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-zinc-900 p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Built-in Detector
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">
            ARP monitor (no separate terminal)
          </h2>
          <p className="mt-1 max-w-xl text-sm text-gray-400">
            The dashboard starts <code className="text-gray-300">detector.py</code>{" "}
            automatically. Run <code className="text-gray-300">npm run dev</code> as
            Administrator so Scapy can capture ARP packets on Windows.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Radio
            className={`h-4 w-4 ${heartbeatOnline ? "text-emerald-400" : "text-gray-500"}`}
          />
          <span className={heartbeatOnline ? "text-emerald-400" : "text-gray-400"}>
            {heartbeatOnline ? "Heartbeat OK" : "No heartbeat"}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`text-sm font-medium ${stateColor[processState]}`}>
          Process: {stateLabel[processState]}
          {status?.pid ? ` (PID ${status.pid})` : ""}
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm text-gray-300">
          Network interface (optional)
          <input
            name="detector_iface"
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            placeholder='Auto-detect, or e.g. \Device\NPF_{...}'
            className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-white focus:ring-2 focus:ring-white/10"
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-300">
          <input
            type="checkbox"
            name="detector_auto_start"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="h-4 w-4 rounded border-white/20"
          />
          Auto-start with dashboard
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || processState === "running" || processState === "starting"}
          onClick={() => runAction("start")}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          Start
        </button>
        <button
          type="button"
          disabled={isPending || processState === "stopped"}
          onClick={() => runAction("stop")}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction("restart")}
          className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Restart
        </button>
      </div>

      {status?.lastError && (
        <p className="mb-3 text-sm text-red-400">{status.lastError}</p>
      )}

      <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs text-gray-400">
        {(status?.log ?? []).length === 0 ? (
          <p>No detector output yet.</p>
        ) : (
          status?.log.slice(-12).map((line, i) => <p key={i}>{line}</p>)
        )}
      </div>
    </div>
  );
}
