"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, WifiOff } from "lucide-react";
import { trustDevice, disconnectDevice } from "@/app/actions";
import type { Device } from "@/lib/types";

export function DeviceRowActions({ device }: { device: Device }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {!device.is_trusted && (
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                await trustDevice(device.id);
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust
          </button>
        )}
        {device.status === "active" && (
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await disconnectDevice(device.id);
                if (!result.success) setError(result.error);
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-red-800 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            <WifiOff className="h-3.5 w-3.5" />
            Disconnect
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
