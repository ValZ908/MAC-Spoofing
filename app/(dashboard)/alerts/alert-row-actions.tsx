"use client";

import { useState, useTransition } from "react";
import { Ban, EyeOff } from "lucide-react";
import { blockAttacker, ignoreAlert } from "@/app/actions";
import type { Alert } from "@/lib/types";

export function AlertRowActions({ alert }: { alert: Alert }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleBlock() {
    setError(null);
    startTransition(async () => {
      const result = await blockAttacker(alert.id, alert.attacker_mac);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          disabled={isPending}
          onClick={handleBlock}
          className="inline-flex items-center gap-1 rounded-md bg-red-700 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          <Ban className="h-3.5 w-3.5" />
          Block Attacker
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await ignoreAlert(alert.id);
            })
          }
          className="inline-flex items-center gap-1 rounded-md border border-white/15 px-3 py-1 text-xs font-medium text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          <EyeOff className="h-3.5 w-3.5" />
          Ignore
        </button>
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}