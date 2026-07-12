import { createClient } from "@/lib/supabase/server";
import { Router, Timer, ShieldCheck, ShieldAlert } from "lucide-react";
import type { RouterConfig } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("router_config")
    .select("*")
    .limit(1)
    .single();

  const config = data as RouterConfig | null;
  const isConfigured = Boolean(config?.router_ip);
  const previewCommand = config?.block_command_template?.replace(
    "{mac}",
    "AA:BB:CC:DD:EE:FF"
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Router Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Credentials detector.py uses to SSH into your router and block confirmed attackers
          automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SettingsForm config={config} />

        <div className="flex flex-col gap-4">
          <div
            className={`flex items-center gap-3 rounded-2xl border p-5 ${
              isConfigured
                ? "border-white/15 bg-white/5"
                : "border-amber-500/30 bg-amber-500/10"
            }`}
          >
            {isConfigured ? (
              <ShieldCheck className="h-6 w-6 shrink-0 text-white" />
            ) : (
              <ShieldAlert className="h-6 w-6 shrink-0 text-amber-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-white">
                {isConfigured ? "Auto-block is active" : "Auto-block not configured yet"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {isConfigured
                  ? "detector.py will SSH into your router and block confirmed attackers automatically."
                  : "Fill in your router IP so detector.py can block confirmed attackers automatically."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-zinc-950 p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Router className="h-3.5 w-3.5" />
              Router
            </p>
            <p className="font-mono text-sm text-white">
              {config?.router_ip || "Not set"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-zinc-950 p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Timer className="h-3.5 w-3.5" />
              Sensitivity
            </p>
            <p className="text-sm text-white">
              An IP claimed by a new MAC within{" "}
              <span className="font-semibold">{config?.spoof_window_seconds ?? 5}s</span> of
              its last known MAC gets flagged as spoofing.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-zinc-950 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Command preview
            </p>
            <p className="rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-gray-300">
              {previewCommand || "No command configured"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Example with a placeholder MAC — this is exactly what runs over SSH when an
              attacker gets blocked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}