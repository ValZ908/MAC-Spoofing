"use client";

import { useState, useTransition } from "react";
import { Terminal, Timer, CheckCircle2, Save } from "lucide-react";
import { saveRouterConfig } from "@/app/actions";
import type { RouterConfig } from "@/lib/types";
import { Panel, PanelEyebrow } from "@/components/ui/panel";
import { DetectorPanel } from "./detector-panel";

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
      <label className="mb-2 flex items-center gap-2 font-mono text-sm font-medium text-[hsl(var(--text-muted))]">
        <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[hsl(var(--signal)/0.1)] text-[hsl(var(--signal))]">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 font-mono text-xs text-[hsl(var(--text-dim))]">{hint}</p>}
    </div>
  );
}

const inputClassName =
  "w-full rounded-sm border border-[hsl(var(--line-strong))] bg-[hsl(var(--surface-3))] px-3 py-2.5 font-mono text-[hsl(var(--text))] outline-none transition placeholder:text-[hsl(var(--text-dim))] focus:border-[hsl(var(--signal))] focus:ring-2 focus:ring-[hsl(var(--signal)/0.15)]";

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
    <div className="flex flex-col gap-6">
      <form
        action={handleSubmit}
        className="flex flex-col gap-6"
      >
        <DetectorPanel
          initialAutoStart={config?.detector_auto_start ?? true}
          initialIface={config?.detector_iface ?? ""}
        />

        <Panel tone="signal" bracketOpacity={0.25} className="w-full p-6 sm:p-8">
      <div className="flex flex-col gap-5">
        <PanelEyebrow>Detection Behavior</PanelEyebrow>

        <FormField
          icon={Terminal}
          label="Block Command"
          hint={`Use {mac} as a placeholder for the attacker's MAC address.`}
        >
          <input
            name="block_command_template"
            defaultValue={config?.block_command_template ?? ""}
            className={`${inputClassName} text-xs`}
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
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-sm bg-[hsl(var(--signal))] py-2.5 font-mono text-sm font-medium text-[hsl(var(--primary-foreground))] transition-all hover:tracking-[0.1em] hover:brightness-110 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save Settings
      </button>

      {status === "saved" && (
        <p className="mt-3 flex items-center gap-1.5 font-mono text-sm text-[hsl(var(--secure))]">
          <CheckCircle2 className="h-4 w-4" />
          Settings saved.
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 font-mono text-sm text-[hsl(var(--danger))]">{error}</p>
      )}
        </Panel>
      </form>
    </div>
  );
}
