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
  ShieldCheck,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: Wifi },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert },
  { href: "/identity", label: "Identity", icon: Fingerprint },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-2 text-base font-semibold text-white">
      <ShieldCheck className="h-5 w-5 shrink-0" />
      <span className="truncate">Network Security Center</span>
    </span>
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
      prefetch
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-white/10 text-white"
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground/80"
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
    <div className="min-h-full bg-black text-slate-100">
      {/* Desktop sidebar — fixed left, open by default, collapsible */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden flex-col overflow-hidden border-white/10 bg-zinc-900 transition-all duration-300 ease-in-out md:flex",
          desktopOpen ? "w-56 border-r" : "w-0 border-r-0"
        )}
      >
        <div className="flex h-full w-56 flex-col px-4 py-6">
          <div className="mb-8 flex items-center justify-between gap-2 px-1">
            <Brand />
            <button
              type="button"
              onClick={() => setDesktopOpen(false)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white/5 hover:text-white"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>
          <DesktopNavLinks />
        </div>
      </aside>

      {/* Reopen button — only rendered once the sidebar is collapsed */}
      {!desktopOpen && (
        <button
          type="button"
          onClick={() => setDesktopOpen(true)}
          className="fixed left-4 top-4 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-zinc-900 text-muted-foreground transition-colors hover:text-white md:flex"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {/* Mobile top bar — closed by default, opens as a slide-in drawer */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-zinc-900 px-4 py-3 md:hidden">
        <Brand />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Menu className="h-[18px] w-[18px]" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-[240px] flex-col border-white/10 bg-zinc-900">
            <div className="mt-8 flex flex-1 flex-col">
              <MobileNavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <main
        className={cn(
          "transition-all duration-300 ease-in-out",
          desktopOpen ? "md:pl-56" : "md:pl-0"
        )}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}