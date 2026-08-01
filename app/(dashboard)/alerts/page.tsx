import { listAlerts } from "@/lib/db/queries";
import { AlertsClient } from "./alerts-client";

export default function AlertsPage() {
  const rows = listAlerts();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Security Alert Log
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Every time an IP appeared to switch MAC addresses. Block confirmed
          attackers, or ignore ones you&apos;ve verified are false alarms
          (adapter changes, DHCP renewals, etc).
        </p>
      </div>
      <AlertsClient initialAlerts={rows} />
    </div>
  );
}
