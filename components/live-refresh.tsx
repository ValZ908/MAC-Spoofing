"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Soft-refresh this server page every few seconds so detector updates appear. */
export function LiveRefresh({ intervalMs = 2_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
