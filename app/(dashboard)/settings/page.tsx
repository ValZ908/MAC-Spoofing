import { getRouterConfig } from "@/lib/db/queries";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const config = getRouterConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Built-in ARP detector, router SSH blocking, and detection sensitivity.
          Stored locally in SQLite — no cloud account required.
        </p>
      </div>
      <SettingsForm config={config} />
    </div>
  );
}
