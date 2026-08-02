import type { NetworkAdapter } from "@/lib/types";

export function isAdapterUp(status: string): boolean {
  return status.trim().toLowerCase() === "up";
}

export function isVirtualAdapter(adapter: NetworkAdapter): boolean {
  const mac = adapter.macAddress.replaceAll(":", "").toUpperCase();
  // Microsoft Hyper-V / virtual switch default MAC prefix
  if (mac.startsWith("02004C") || mac.startsWith("00155D")) return true;
  const hint = `${adapter.name} ${adapter.description}`.toLowerCase();
  return /virtual|hyper-v|vmware|vpn|tap|sstp|loopback|wsl|sstap|bluetooth|default switch|vethernet/i.test(
    hint
  );
}

export function isPhysicalAdapter(adapter: NetworkAdapter): boolean {
  return isAdapterUp(adapter.status) && !isVirtualAdapter(adapter);
}

export function sortAdapters(adapters: NetworkAdapter[]): NetworkAdapter[] {
  return [...adapters].sort((a, b) => {
    const aUp = isAdapterUp(a.status) ? 0 : 1;
    const bUp = isAdapterUp(b.status) ? 0 : 1;
    if (aUp !== bUp) return aUp - bUp;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}
