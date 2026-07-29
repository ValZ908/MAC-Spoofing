"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wifi,
  ShieldAlert,
  Fingerprint,
  Settings,
  ShieldCheck,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DetectorHeartbeat } from "@/lib/types";

const HEARTBEAT_STALE_MS = 25_000;

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: Wifi },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert },
  { href: "/identity", label: "Identity", icon: Fingerprint },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
        <ShieldCheck className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold text-foreground">
          Network Security Center
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          MAC Spoofing Monitor
        </span>
      </span>
    </span>
  );
}

/** Polls the detector heartbeat so the sidebar reflects real agent status. */
function SystemStatusCard() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          lastHeartbeat: DetectorHeartbeat | null;
        };
        const last = data.lastHeartbeat;
        const isOnline =
          last !== null &&
          Date.now() - new Date(last.last_seen).getTime() < HEARTBEAT_STALE_MS;
        if (!cancelled) setOnline(isOnline);
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    void check();
    const id = setInterval(() => void check(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        online ? "border-emerald-500/30 bg-emerald-500/10" : "border-border bg-muted"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-xs font-semibold",
          online ? "text-emerald-400" : "text-foreground"
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        System Status
      </div>
      <p className={cn("mt-0.5 text-xs", online ? "text-emerald-400" : "text-muted-foreground")}>
        {online === null
          ? "Checking…"
          : online
            ? "All systems operational"
            : "Detector agent offline"}
      </p>
    </div>
  );
}

function NavLinkItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "border-emerald-500 bg-emerald-500/10 font-medium text-emerald-400"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function DesktopNavLinks() {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <NavLinkItem key={link.href} {...link} />
      ))}
    </nav>
  );
}

function MobileNavLinks() {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <SheetClose asChild key={link.href}>
          <NavLinkItem {...link} />
        </SheetClose>
      ))}
    </nav>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [desktopOpen, setDesktopOpen] = useState(true);

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Desktop sidebar — fixed left, open by default, collapsible */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden flex-col overflow-hidden border-border bg-background transition-all duration-300 ease-in-out md:flex",
          desktopOpen ? "w-64 border-r" : "w-0 border-r-0"
        )}
      >
        <div className="flex h-full w-64 flex-col px-4 py-6">
          <div className="mb-8 flex items-center justify-between gap-2 px-1">
            <Brand />
            <button
              type="button"
              onClick={() => setDesktopOpen(false)}
              className="shrink-0 rounded-md border border-transparent p-1 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <DesktopNavLinks />
          <div className="mt-auto pt-4">
            <SystemStatusCard />
          </div>
        </div>
      </aside>

      {/* Reopen button — only rendered once the sidebar is collapsed */}
      {!desktopOpen && (
        <button
          type="button"
          onClick={() => setDesktopOpen(true)}
          className="fixed left-4 top-4 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground md:flex"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Mobile top bar — closed by default, opens as a slide-in drawer */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <Brand />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Menu className="h-[18px] w-[18px]" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[240px] flex-col border-border bg-background">
            <div className="mt-8 flex flex-1 flex-col">
              <MobileNavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          desktopOpen ? "md:pl-64" : "md:pl-0"
        )}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
