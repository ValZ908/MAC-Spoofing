// app/dashboard/settings/page.tsx
import { getRouterConfig } from "@/lib/db/queries";
import { SettingsForm } from "./settings-form";
import { SettingsSidebar } from "./settings-sidebar";

export default async function SettingsPage() {
  const config = getRouterConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure SSH access to your router so alerts can auto-block attacker MACs.
          Stored locally in SQLite — no cloud account required.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <SettingsForm config={config} />
        <SettingsSidebar />
      </div>
    </div>
  );
}
