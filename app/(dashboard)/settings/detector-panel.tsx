"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Play, RotateCcw, Square, Radio } from "lucide-react";
import { Panel, PanelEyebrow } from "@/components/ui/panel";

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
  stopped: "text-[hsl(var(--text-dim))]",
  starting: "text-[hsl(var(--warn))]",
  running: "text-[hsl(var(--secure))]",
  crashed: "text-[hsl(var(--danger))]",
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
    <Panel tone="signal" bracketOpacity={0.25} className="w-full p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <PanelEyebrow>Built-in Detector</PanelEyebrow>
          <h2 className="mt-1 font-display text-lg font-semibold text-[hsl(var(--text))]">
            ARP monitor (no separate terminal)
          </h2>
          <p className="mt-1 max-w-xl font-mono text-sm text-[hsl(var(--text-muted))]">
            The dashboard starts <code className="text-[hsl(var(--text))]">detector.py</code>{" "}
            automatically. Run <code className="text-[hsl(var(--text))]">npm run dev</code> as
            Administrator so Scapy can capture ARP packets on Windows.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm">
          <Radio
            className={`h-4 w-4 ${heartbeatOnline ? "text-[hsl(var(--secure))]" : "text-[hsl(var(--text-dim))]"}`}
          />
          <span className={heartbeatOnline ? "text-[hsl(var(--secure))]" : "text-[hsl(var(--text-muted))]"}>
            {heartbeatOnline ? "Heartbeat OK" : "No heartbeat"}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`font-mono text-sm font-medium ${stateColor[processState]}`}>
          Process: {stateLabel[processState]}
          {status?.pid ? ` (PID ${status.pid})` : ""}
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 font-mono text-sm text-[hsl(var(--text-muted))]">
          Network interface (optional)
          <input
            name="detector_iface"
            value={iface}
            onChange={(e) => setIface(e.target.value)}
            placeholder='Auto-detect, or e.g. \Device\NPF_{...}'
            className="w-full rounded-sm border border-[hsl(var(--line-strong))] bg-[hsl(var(--surface-3))] px-3 py-2.5 font-mono text-xs text-[hsl(var(--text))] outline-none focus:border-[hsl(var(--signal))] focus:ring-2 focus:ring-[hsl(var(--signal)/0.15)]"
          />
        </label>
        <label className="flex items-center gap-2 pb-2.5 font-mono text-sm text-[hsl(var(--text-muted))]">
          <input
            type="checkbox"
            name="detector_auto_start"
            checked={autoStart}
            onChange={(e) => setAutoStart(e.target.checked)}
            className="h-4 w-4 rounded-sm border-[hsl(var(--line-strong))] accent-[hsl(var(--signal))]"
          />
          Auto-start with dashboard
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending || processState === "running" || processState === "starting"}
          onClick={() => runAction("start")}
          className="inline-flex items-center gap-2 rounded-sm bg-[hsl(var(--signal))] px-4 py-2 font-mono text-sm font-medium text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          Start
        </button>
        <button
          type="button"
          disabled={isPending || processState === "stopped"}
          onClick={() => runAction("stop")}
          className="inline-flex items-center gap-2 rounded-sm border border-[hsl(var(--line-strong))] px-4 py-2 font-mono text-sm text-[hsl(var(--text))] transition hover:bg-[hsl(var(--surface-2))] disabled:opacity-50"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => runAction("restart")}
          className="inline-flex items-center gap-2 rounded-sm border border-[hsl(var(--line-strong))] px-4 py-2 font-mono text-sm text-[hsl(var(--text))] transition hover:bg-[hsl(var(--surface-2))] disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          Restart
        </button>
      </div>

      {status?.lastError && (
        <p className="mb-3 font-mono text-sm text-[hsl(var(--danger))]">{status.lastError}</p>
      )}

      <div className="max-h-40 overflow-y-auto rounded-sm border border-[hsl(var(--line))] bg-black/40 p-3 font-mono text-xs text-[hsl(var(--text-muted))]">
        {(status?.log ?? []).length === 0 ? (
          <p>No detector output yet.</p>
        ) : (
          status?.log.slice(-12).map((line, i) => <p key={i}>{line}</p>)
        )}
      </div>
    </Panel>
  );
}
