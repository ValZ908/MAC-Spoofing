"use client";

import { useState, useTransition } from "react";
import {
  Router,
  User,
  Lock,
  Terminal,
  Timer,
  CheckCircle2,
  Save,
} from "lucide-react";
import { saveRouterConfig } from "@/app/actions";
import type { RouterConfig } from "@/lib/types";

function FormField({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-slate-100 outline-none transition focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20";

export function SettingsForm({ config }: { config: RouterConfig | null }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await saveRouterConfig(formData);
      if (result.success) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error);
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Router Connection
        </p>

        <FormField icon={Router} label="Router IP Address">
          <input
            name="router_ip"
            defaultValue={config?.router_ip ?? ""}
            placeholder="192.168.1.1"
            className={inputClassName}
          />
        </FormField>

        <FormField icon={User} label="Router Username">
          <input
            name="username"
            defaultValue={config?.username ?? ""}
            className={inputClassName}
          />
        </FormField>

        <FormField icon={Lock} label="Router Password">
          <input
            name="password"
            type="password"
            defaultValue={config?.password ?? ""}
            className={inputClassName}
          />
        </FormField>
      </div>

      <div className="my-6 border-t border-slate-800" />

      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Detection Behavior
        </p>

        <FormField
          icon={Terminal}
          label="Block Command"
          hint={`Use {mac} as a placeholder for the attacker's MAC address.`}
        >
          <input
            name="block_command_template"
            defaultValue={config?.block_command_template ?? ""}
            className={`${inputClassName} font-mono text-xs`}
          />
        </FormField>

        <FormField
          icon={Timer}
          label="Sensitivity (seconds)"
          hint="Minimum time window for an IP change to be flagged as spoofing."
        >
          <input
            name="spoof_window_seconds"
            type="number"
            min={1}
            defaultValue={config?.spoof_window_seconds ?? 5}
            className={inputClassName}
          />
        </FormField>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 py-2.5 text-sm font-medium text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:from-emerald-400 hover:to-emerald-300 hover:shadow-[0_0_28px_rgba(16,185,129,0.4)] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save Settings
      </button>

      {status === "saved" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Settings saved.
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}
