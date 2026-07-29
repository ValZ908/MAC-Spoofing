"use client";

import { useState, useTransition } from "react";
import { Terminal, CheckCircle2, Save } from "lucide-react";
import { saveRouterConfig } from "@/app/actions";
import type { RouterConfig } from "@/lib/types";

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function NumberRow({
  name,
  label,
  hint,
  defaultValue,
  min,
  max,
  suffix,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
  min?: number;
  max?: number;
  suffix: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 not-last:border-b border-border">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          name={name}
          type="number"
          min={min}
          max={max}
          defaultValue={defaultValue}
          className="w-[72px] rounded-lg border border-input bg-background px-2 py-1.5 text-right text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

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
    <form action={handleSubmit} className="w-full max-w-2xl">
      <GroupLabel>Response</GroupLabel>
      <div className="rounded-2xl border border-border bg-card px-5">
        <div className="border-b border-border py-4">
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            Block command
          </label>
          <p className="mb-2 text-xs text-muted-foreground">
            Runs on your router over SSH. {"{mac}"} is replaced at run time.
          </p>
          <input
            name="block_command_template"
            defaultValue={config?.block_command_template ?? ""}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <NumberRow
          name="alert_cooldown_seconds"
          label="Alert cooldown"
          hint="Suppress duplicate alerts for the same attacker."
          defaultValue={config?.alert_cooldown_seconds ?? 300}
          min={30}
          suffix="sec"
        />
      </div>

      <GroupLabel>
        <span className="mt-5 block">Detection thresholds</span>
      </GroupLabel>
      <div className="rounded-2xl border border-border bg-card px-5">
        <NumberRow
          name="spoof_window_seconds"
          label="Spoof window"
          hint="Lower = stricter, fewer slow DHCP false alarms."
          defaultValue={config?.spoof_window_seconds ?? 2}
          min={1}
          max={30}
          suffix="sec"
        />
        <NumberRow
          name="min_poisoning_ips"
          label="Min IPs for ARP poisoning"
          hint="Non-gateway IPs one MAC must claim first."
          defaultValue={config?.min_poisoning_ips ?? 3}
          min={2}
          max={10}
          suffix="IPs"
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {status === "saved" && (
          <p className="flex items-center gap-1.5 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Saved.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
