// app/dashboard/settings/settings-sidebar.tsx
"use client";

import { RefreshCw } from "lucide-react";

export function SettingsSidebar() {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Router connection
      </p>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Connection status isn't tracked yet.
        </p>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-input bg-background py-1.5 text-xs text-foreground transition hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Test connection
        </button>
      </div>
    </div>
  );
}
