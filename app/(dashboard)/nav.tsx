"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Wifi,
  ShieldAlert,
  Fingerprint,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: Wifi },
  { href: "/alerts", label: "Alerts", icon: ShieldAlert },
  { href: "/identity", label: "Identity", icon: Fingerprint },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="ghost"
        className={cn(
          "h-8 gap-2 px-2 text-sm font-normal text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>
    </form>
  );
}

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between rounded-xl border border-white/10 bg-[#11141d] px-4 py-2 shadow-lg"
    >
      <div className="flex items-center space-x-6">
        <span className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          Network Security Center
        </span>
        <div className="hidden items-center space-x-1 md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-muted-foreground hover:text-foreground/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <Separator orientation="vertical" className="hidden h-6 md:block" />
        <SignOutButton className="hidden md:inline-flex" />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
              <Menu className="h-[18px] w-[18px]" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-[240px] border-white/10 bg-[#11141d] sm:w-[300px]"
          >
            <nav className="mt-8 flex flex-col space-y-1">
              {links.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-muted-foreground hover:text-foreground/80"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
              <Separator className="my-2" />
              <SignOutButton className="justify-start px-3" />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </motion.nav>
  );
}
