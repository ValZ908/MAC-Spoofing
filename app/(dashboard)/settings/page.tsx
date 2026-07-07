import { createClient } from "@/lib/supabase/server";
import type { RouterConfig } from "@/lib/types";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("router_config")
    .select("*")
    .limit(1)
    .single();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-100">
        Router Settings
      </h1>
      <SettingsForm config={config as RouterConfig} />
    </div>
  );
}
