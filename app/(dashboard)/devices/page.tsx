import { createClient } from "@/lib/supabase/server";
import type { Device } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { DeviceRowActions } from "./device-row-actions";

export default async function DevicesPage() {
  const supabase = await createClient();
  const { data: devices } = await supabase
    .from("devices")
    .select("*")
    .order("last_seen", { ascending: false });

  const rows = (devices as Device[]) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Connected Devices</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every device detector.py has seen on the network. Mark the ones you recognize as
          Trusted so unknown devices stand out.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-zinc-950 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">IP Address</th>
              <th className="px-4 py-3 font-medium">MAC Address</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trusted</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-zinc-950">
            {rows.map((device) => (
              <tr key={device.id} className="text-gray-300 transition hover:bg-white/5">
                <td className="px-4 py-3">{device.ip_address ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
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
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
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