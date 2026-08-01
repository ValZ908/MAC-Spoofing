"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ShieldCheck, WifiOff } from "lucide-react";
import { disconnectDevice, trustDevice } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import type { Device } from "@/lib/types";

export function DevicesClient({ initialDevices }: { initialDevices: Device[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const syncFromApi = useCallback(async () => {
    try {
      const res = await fetch("/api/devices", { cache: "no-store" });
      if (res.ok) setDevices((await res.json()) as Device[]);
    } catch {
      /* keep snapshot */
    }
  }, []);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices]);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void syncFromApi();
    };
    const id = setInterval(run, 12_000);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [syncFromApi]);

  function trust(device: Device) {
    setErrorById((e) => ({ ...e, [device.id]: "" }));
    setDevices((list) =>
      list.map((d) => (d.id === device.id ? { ...d, is_trusted: true } : d))
    );
    setPendingId(device.id);
    startTransition(async () => {
      await trustDevice(device.id);
      setPendingId(null);
      void syncFromApi();
    });
  }

  function disconnect(device: Device) {
    setErrorById((e) => ({ ...e, [device.id]: "" }));
    setDevices((list) =>
      list.map((d) =>
        d.id === device.id ? { ...d, status: "disconnected" as const } : d
      )
    );
    setPendingId(device.id);
    startTransition(async () => {
      const result = await disconnectDevice(device.id);
      setPendingId(null);
      if (!result.success) {
        setErrorById((e) => ({ ...e, [device.id]: result.error }));
        void syncFromApi();
      } else {
        void syncFromApi();
      }
    });
  }

  return (
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
          {devices.map((device) => (
            <tr
              key={device.id}
              className="text-gray-300 transition hover:bg-white/10"
            >
              <td className="px-4 py-3">{device.ip_address ?? "-"}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-400">
                {device.mac_address}
              </td>
              <td className="px-4 py-3">{device.vendor ?? "-"}</td>
              <td className="px-4 py-3">
                <Badge
                  variant={device.status === "active" ? "success" : "neutral"}
                >
                  {device.status === "active" ? "Active" : "Disconnected"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant={device.is_trusted ? "success" : "neutral"}>
                  {device.is_trusted ? "Trusted" : "Untrusted"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    {!device.is_trusted && (
                      <button
                        disabled={pendingId === device.id}
                        onClick={() => trust(device)}
                        className="inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Trust
                      </button>
                    )}
                    {device.status === "active" && (
                      <button
                        disabled={pendingId === device.id}
                        onClick={() => disconnect(device)}
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        <WifiOff className="h-3.5 w-3.5" />
                        Disconnect
                      </button>
                    )}
                  </div>
                  {errorById[device.id] && (
                    <span className="text-xs text-red-600">
                      {errorById[device.id]}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                No devices detected yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
