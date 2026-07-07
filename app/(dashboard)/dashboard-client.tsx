"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Wifi, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Alert } from "@/lib/types";

type Props = {
  initialActiveDeviceCount: number;
  initialRecentAlerts: Alert[];
  initialUnhandledCount: number;
};

const badgeClasses: Record<Alert["status"], string> = {
  unhandled:
    "bg-red-500/10 text-red-400 border border-red-500/20",
  blocked:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  ignored:
    "bg-slate-400/10 text-slate-400 border border-slate-400/20",
};

export function DashboardClient({
  initialActiveDeviceCount,
  initialRecentAlerts,
  initialUnhandledCount,
}: Props) {
  const [activeDeviceCount, setActiveDeviceCount] = useState(
    initialActiveDeviceCount
  );
  const [recentAlerts, setRecentAlerts] = useState(initialRecentAlerts);
  const [unhandledCount, setUnhandledCount] = useState(
    initialUnhandledCount
  );

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        async () => {
          const [{ data: alerts }, { count }] = await Promise.all([
            supabase
              .from("alerts")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("alerts")
              .select("*", { count: "exact", head: true })
              .eq("status", "unhandled"),
          ]);
          setRecentAlerts((alerts as Alert[]) ?? []);
          setUnhandledCount(count ?? 0);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices" },
        async () => {
          const { count } = await supabase
            .from("devices")
            .select("*", { count: "exact", head: true })
            .eq("status", "active");
          setActiveDeviceCount(count ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isDanger = unhandledCount > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero status banner */}
      <div
        className={`flex flex-col items-center justify-center rounded-[32px] border p-20 text-center ${
          isDanger
            ? "border-red-700/40 bg-gradient-to-b from-red-700/10 to-red-700/[0.02] shadow-[inset_0_0_50px_rgba(185,28,28,0.05)]"
            : "border-emerald-700/40 bg-gradient-to-b from-emerald-700/10 to-emerald-700/[0.02] shadow-[inset_0_0_50px_rgba(16,185,129,0.05)]"
        }`}
      >
        <div
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full border ${
            isDanger
              ? "border-red-500/20 bg-red-900/20"
              : "border-emerald-500/20 bg-emerald-900/20"
          }`}
        >
          {isDanger ? (
            <ShieldAlert className="h-8 w-8 text-red-500" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
          )}
        </div>
        <h1 className="mb-2 text-5xl font-bold tracking-tight text-white">
          {isDanger ? "Attack Detected" : "Secure"}
        </h1>
        {isDanger && (
          <p className="text-sm font-medium tracking-wide text-red-400">
            {unhandledCount} unhandled alert{unhandledCount === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex min-h-[400px] flex-col justify-start rounded-[32px] border border-white/5 bg-[#11141d] p-10 lg:col-span-5">
          <div className="mb-8 flex items-center gap-3 text-gray-500">
            <Wifi className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]">
              Active Devices
            </h3>
          </div>
          <span className="text-[120px] font-bold leading-none tracking-tighter">
            {activeDeviceCount}
          </span>
        </div>

        <div className="flex flex-col rounded-[32px] border border-white/5 bg-[#11141d] p-10 lg:col-span-7">
          <div className="mb-8 flex items-center gap-3 text-gray-500">
            <Bell className="h-5 w-5" />
            <h3 className="text-sm font-bold uppercase tracking-[0.15em]">
              Recent Alerts
            </h3>
          </div>

          {recentAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">No alerts yet.</p>
          ) : (
            <div className="space-y-4">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#1c212e] p-5"
                >
                  <div className="text-sm font-medium text-gray-300">
                    {new Date(alert.created_at).toLocaleString("en-US")}
                    <span className="mx-3 text-gray-700">•</span>
                    {alert.target_ip}
                  </div>
                  <span
                    className={`rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${badgeClasses[alert.status]}`}
                  >
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
