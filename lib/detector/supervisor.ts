import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { getRouterConfig } from "@/lib/db/queries";

const MAX_LOG_LINES = 150;

export type DetectorState = "stopped" | "starting" | "running" | "crashed";

export type DetectorStatus = {
  state: DetectorState;
  pid: number | null;
  startedAt: string | null;
  lastError: string | null;
  exitCode: number | null;
  log: string[];
  iface: string | null;
  apiBase: string;
};

type GlobalSupervisor = {
  __detectorSupervisor?: DetectorSupervisor;
};

function dashboardApiBase(): string {
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}`;
}

function resolvePython(): string {
  return process.env.PYTHON ?? "python";
}

class DetectorSupervisor {
  private child: ChildProcessWithoutNullStreams | null = null;
  private state: DetectorState = "stopped";
  private startedAt: string | null = null;
  private lastError: string | null = null;
  private exitCode: number | null = null;
  private logLines: string[] = [];
  private iface: string | null = null;
  private autoStartScheduled = false;

  private pushLog(line: string) {
    const trimmed = line.trimEnd();
    if (!trimmed) return;
    this.logLines.push(trimmed);
    if (this.logLines.length > MAX_LOG_LINES) {
      this.logLines = this.logLines.slice(-MAX_LOG_LINES);
    }
  }

  private attachChild(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    this.state = "starting";
    this.startedAt = new Date().toISOString();
    this.lastError = null;
    this.exitCode = null;

    child.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        this.pushLog(line);
      }
      if (this.state === "starting") this.state = "running";
    });

    child.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        this.pushLog(`[stderr] ${line}`);
      }
    });

    child.on("error", (err) => {
      this.lastError = err.message;
      this.state = "crashed";
      this.child = null;
    });

    child.on("exit", (code, signal) => {
      this.exitCode = code;
      if (signal) {
        this.lastError = `Process killed (${signal})`;
      } else if (code && code !== 0) {
        this.lastError = `Detector exited with code ${code}`;
      }
      if (this.state !== "stopped") {
        this.state = code === 0 ? "stopped" : "crashed";
      }
      this.child = null;
    });
  }

  isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  getStatus(): DetectorStatus {
    if (this.isRunning() && this.state === "starting") {
      this.state = "running";
    }
    return {
      state: this.isRunning() ? this.state : this.state === "running" ? "stopped" : this.state,
      pid: this.child?.pid ?? null,
      startedAt: this.startedAt,
      lastError: this.lastError,
      exitCode: this.exitCode,
      log: [...this.logLines],
      iface: this.iface,
      apiBase: dashboardApiBase(),
    };
  }

  start(options?: { iface?: string }) {
    if (this.isRunning()) {
      return this.getStatus();
    }

    const config = getRouterConfig();
    const iface = (options?.iface ?? config.detector_iface).trim() || null;
    this.iface = iface;

    const script = path.join(process.cwd(), "detector.py");
    const args = [script, "--api", dashboardApiBase()];
    if (iface) args.push("--iface", iface);

    const child = spawn(resolvePython(), args, {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      windowsHide: true,
    });

    this.attachChild(child);
    this.pushLog(`[supervisor] Started detector (pid ${child.pid ?? "?"})`);
    return this.getStatus();
  }

  stop() {
    if (!this.child) {
      this.state = "stopped";
      return this.getStatus();
    }

    this.state = "stopped";
    const child = this.child;
    child.kill("SIGTERM");

    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 3_000).unref();

    this.child = null;
    this.pushLog("[supervisor] Detector stopped");
    return this.getStatus();
  }

  restart(options?: { iface?: string }) {
    this.stop();
    return this.start(options);
  }

  scheduleAutoStart(delayMs = 4_000) {
    if (this.autoStartScheduled) return;
    const config = getRouterConfig();
    if (!config.detector_auto_start) return;

    this.autoStartScheduled = true;
    setTimeout(() => {
      if (!this.isRunning()) {
        try {
          this.start();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.lastError = message;
          this.state = "crashed";
          this.pushLog(`[supervisor] Auto-start failed: ${message}`);
        }
      }
    }, delayMs).unref();
  }
}

export function getDetectorSupervisor(): DetectorSupervisor {
  const g = globalThis as typeof globalThis & GlobalSupervisor;
  if (!g.__detectorSupervisor) {
    g.__detectorSupervisor = new DetectorSupervisor();
  }
  return g.__detectorSupervisor;
}

export function startDetectorSupervisor() {
  getDetectorSupervisor().scheduleAutoStart();
}
