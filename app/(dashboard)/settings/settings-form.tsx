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
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-300">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-white outline-none transition placeholder:text-gray-500 focus:border-white focus:ring-2 focus:ring-white/10";

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
      className="w-full rounded-2xl border border-white/10 bg-zinc-900 p-6 sm:p-8"
    >
      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
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

      <div className="my-6 border-t border-white/10" />

      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
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
          label="Spoof window (seconds)"
          hint="Only flag IP→MAC changes faster than this. Lower = stricter, fewer slow DHCP false alarms."
        >
          <input
            name="spoof_window_seconds"
            type="number"
            min={1}
            max={30}
            defaultValue={config?.spoof_window_seconds ?? 2}
            className={inputClassName}
          />
        </FormField>

        <FormField
          icon={Timer}
          label="Alert cooldown (seconds)"
          hint="Suppress duplicate alerts for the same attacker within this period."
        >
          <input
            name="alert_cooldown_seconds"
            type="number"
            min={30}
            defaultValue={config?.alert_cooldown_seconds ?? 300}
            className={inputClassName}
          />
        </FormField>

        <FormField
          icon={Timer}
          label="Min IPs for ARP poisoning"
          hint="One MAC must claim at least this many non-gateway IPs before alerting. Higher = stricter."
        >
          <input
            name="min_poisoning_ips"
            type="number"
            min={2}
            max={10}
            defaultValue={config?.min_poisoning_ips ?? 3}
            className={inputClassName}
          />
        </FormField>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-all hover:tracking-[0.15em] hover:bg-zinc-200 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save Settings
      </button>

      {status === "saved" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-white">
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