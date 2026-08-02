"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wifi,
  ShieldAlert,
  Fingerprint,
  Settings,
  ShieldHalf,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, code: "01" },
  { href: "/devices", label: "Devices", icon: Wifi, code: "02" },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert, code: "03" },
  { href: "/identity", label: "Identity", icon: Fingerprint, code: "04" },
  { href: "/settings", label: "Settings", icon: Settings, code: "05" },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[hsl(var(--signal)/0.4)] bg-[hsl(var(--signal)/0.08)]">
        <ShieldHalf className="h-4 w-4 text-[hsl(var(--signal))]" />
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--signal))] shadow-[0_0_6px_hsl(var(--signal))]" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold leading-tight text-[hsl(var(--text))]">
            Network Security
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--text-dim))]">
            Local Console
          </span>
        </span>
      )}
    </span>
  );
}

function NavLinkItem({
  href,
  label,
  icon: Icon,
  code,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  code: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "group relative flex items-center gap-3 rounded-sm px-3 py-2.5 font-mono text-[13px] transition-colors",
        isActive
          ? "bg-[hsl(var(--signal)/0.1)] text-[hsl(var(--signal))]"
          : "text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))]"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 transition-opacity",
          isActive ? "bg-[hsl(var(--signal))] opacity-100" : "opacity-0"
        )}
      />
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] text-[hsl(var(--text-dim))] group-hover:text-[hsl(var(--text-muted))]">
        {code}
      </span>
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
    <div className="min-h-full bg-[hsl(var(--surface-0))] text-[hsl(var(--text))]">
      {/* Desktop sidebar — fixed left control rail, open by default, collapsible */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden flex-col overflow-hidden border-[hsl(var(--line))] bg-[hsl(var(--surface-1))] transition-all duration-300 ease-in-out md:flex",
          desktopOpen ? "w-60 border-r" : "w-0 border-r-0"
        )}
      >
        <div className="flex h-full w-60 flex-col px-4 py-5">
          <div className="mb-8 flex items-center justify-between gap-2 border-b border-[hsl(var(--line))] px-1 pb-5">
            <Brand />
            <button
              type="button"
              onClick={() => setDesktopOpen(false)}
              className="shrink-0 rounded-sm p-1 text-[hsl(var(--text-dim))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text))]"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <DesktopNavLinks />

          <div className="mt-auto flex items-center gap-2 border-t border-[hsl(var(--line))] pt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--text-dim))]">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--signal))]" />
            Running locally
          </div>
        </div>
      </aside>

      {/* Reopen button — only rendered once the sidebar is collapsed */}
      {!desktopOpen && (
        <button
          type="button"
          onClick={() => setDesktopOpen(true)}
          className="fixed left-4 top-4 z-30 hidden h-8 w-8 items-center justify-center rounded-sm border border-[hsl(var(--line))] bg-[hsl(var(--surface-1))] text-[hsl(var(--text-dim))] transition-colors hover:text-[hsl(var(--text))] md:flex"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Mobile top bar — closed by default, opens as a slide-in drawer */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[hsl(var(--line))] bg-[hsl(var(--surface-1))] px-4 py-3 md:hidden">
        <Brand compact />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Menu className="h-[18px] w-[18px]" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-[240px] flex-col border-[hsl(var(--line))] bg-[hsl(var(--surface-1))]"
          >
            <div className="mt-8 flex flex-1 flex-col">
              <MobileNavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          desktopOpen ? "md:pl-60" : "md:pl-0"
        )}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

