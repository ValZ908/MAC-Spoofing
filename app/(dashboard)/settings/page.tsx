import { getRouterConfig } from "@/lib/db/queries";
import { SettingsForm } from "./settings-form";
import { PanelEyebrow } from "@/components/ui/panel";

export default async function SettingsPage() {
  const config = getRouterConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PanelEyebrow className="mb-1.5">05 / Settings</PanelEyebrow>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[hsl(var(--text))]">
          Settings
        </h1>
        <p className="mt-1 font-mono text-sm text-[hsl(var(--text-muted))]">
          Built-in ARP detector, router SSH blocking, and detection sensitivity.
          Stored locally in SQLite — no cloud account required.
        </p>
      </div>
      <SettingsForm config={config} />
    </div>
  );
}
