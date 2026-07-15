import { listDevices } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { DeviceRowActions } from "./device-row-actions";
import { LiveRefresh } from "@/components/live-refresh";

export default async function DevicesPage() {
  const rows = listDevices();

  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Connected Devices</h1>
        <p className="mt-1 text-sm text-gray-400">
          Every device detector.py has seen on the network. Mark the ones you recognize as
          Trusted so unknown devices stand out.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-zinc-900 text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">IP Address</th>
              <th className="px-4 py-3 font-medium">MAC Address</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trusted</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-zinc-900">
            {rows.map((device) => (
              <tr key={device.id} className="text-gray-300 transition hover:bg-white/10">
                <td className="px-4 py-3">{device.ip_address ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {device.mac_address}
                </td>
                <td className="px-4 py-3">{device.vendor ?? "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant={device.status === "active" ? "success" : "neutral"}>
                    {device.status === "active" ? "Active" : "Disconnected"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={device.is_trusted ? "success" : "neutral"}>
                    {device.is_trusted ? "Trusted" : "Untrusted"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <DeviceRowActions device={device} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No devices detected yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
