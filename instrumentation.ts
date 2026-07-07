export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAdapterLockWatchdog } = await import(
      "@/lib/network/lock-watchdog"
    );
    startAdapterLockWatchdog();
  }
}
