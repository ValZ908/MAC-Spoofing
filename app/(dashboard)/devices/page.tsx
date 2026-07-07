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
      <h1 className="text-xl font-semibold text-slate-100">
        Connected Devices
      </h1>

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">IP Address</th>
              <th className="px-4 py-3 font-medium">MAC Address</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trusted</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950">
            {rows.map((device) => (
              <tr
                key={device.id}
                className="text-slate-200 transition hover:bg-slate-900/60"
              >
                <td className="px-4 py-3">{device.ip_address ?? "-"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
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
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
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
