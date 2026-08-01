export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAdapterLockWatchdog } = await import(
      "@/lib/network/lock-watchdog"
    );
    startAdapterLockWatchdog();

    const { startDetectorSupervisor } = await import(
      "@/lib/detector/supervisor"
    );
    startDetectorSupervisor();
  }
}
