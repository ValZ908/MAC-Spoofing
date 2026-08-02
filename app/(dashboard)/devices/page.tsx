import { listDevices } from "@/lib/db/queries";
import { DevicesClient } from "./devices-client";
import { PanelEyebrow } from "@/components/ui/panel";

export default function DevicesPage() {
  const rows = listDevices();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PanelEyebrow className="mb-1.5">02 / Devices</PanelEyebrow>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[hsl(var(--text))] sm:text-3xl">
          Connected Devices
        </h1>
        <p className="mt-1 font-mono text-sm text-[hsl(var(--text-muted))]">
          Every device the built-in detector has seen on the network. Mark the ones you
          recognize as Trusted so unknown devices stand out.
        </p>
      </div>
      <DevicesClient initialDevices={rows} />
    </div>
  );
}
