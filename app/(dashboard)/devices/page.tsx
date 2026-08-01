import { listDevices } from "@/lib/db/queries";
import { DevicesClient } from "./devices-client";

export default function DevicesPage() {
  const rows = listDevices();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Connected Devices
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Every device the built-in detector has seen on the network. Mark the ones you
          recognize as Trusted so unknown devices stand out.
        </p>
      </div>
      <DevicesClient initialDevices={rows} />
    </div>
  );
}
