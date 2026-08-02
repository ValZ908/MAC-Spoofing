import { listAlerts } from "@/lib/db/queries";
import { AlertsClient } from "./alerts-client";
import { PanelEyebrow } from "@/components/ui/panel";

export default function AlertsPage() {
  const rows = listAlerts();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PanelEyebrow className="mb-1.5">03 / Alerts</PanelEyebrow>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[hsl(var(--text))] sm:text-3xl">
          Security Alert Log
        </h1>
        <p className="mt-1 font-mono text-sm text-[hsl(var(--text-muted))]">
          Every time an IP appeared to switch MAC addresses. Block confirmed
          attackers, or ignore ones you&apos;ve verified are false alarms
          (adapter changes, DHCP renewals, etc).
        </p>
      </div>
      <AlertsClient initialAlerts={rows} />
    </div>
  );
}
