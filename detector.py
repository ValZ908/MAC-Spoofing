"""
Local ARP monitor for MAC spoofing / ARP poisoning.

Talks to the Next.js dashboard over HTTP on localhost — no cloud account
or .env file required. Start the dashboard first (`npm run dev`), then:

    python detector.py

Optional:

    python detector.py --api http://127.0.0.1:3000
"""

from __future__ import annotations

import argparse
import socket
import threading
import time
from datetime import datetime, timezone

import requests
from scapy.all import ARP, sniff

try:
    from mac_vendor_lookup import MacLookup

    _mac_lookup = MacLookup()
except ImportError:
    _mac_lookup = None
    print(
        "[WARN] mac_vendor_lookup not installed, Vendor column will stay empty. "
        "Run: pip install mac-vendor-lookup"
    )

DEFAULT_API_BASE = "http://127.0.0.1:3000"
DEFAULT_SPOOF_WINDOW_SECONDS = 5
HEARTBEAT_INTERVAL_SECONDS = 10

# ip -> {"mac": str, "last_seen": datetime}
ip_mac_table: dict[str, dict] = {}

# mac -> {ip: datetime, ...}
mac_ip_table: dict[str, dict[str, datetime]] = {}

_vendor_cache: dict[str, str | None] = {}
_api_base = DEFAULT_API_BASE


def api_url(path: str) -> str:
    return f"{_api_base.rstrip('/')}{path}"


def get_router_config() -> dict:
    """Read sensitivity (and router readiness) from the local dashboard API."""
    try:
        response = requests.get(api_url("/api/detector/config"), timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        print(f"[ERROR] Failed to read config from dashboard: {exc}")
        return {}


def get_spoof_window_seconds(config: dict) -> int:
    if config and config.get("spoof_window_seconds"):
        try:
            return int(config["spoof_window_seconds"])
        except (TypeError, ValueError):
            pass
    return DEFAULT_SPOOF_WINDOW_SECONDS


def lookup_vendor(mac: str) -> str | None:
    if _mac_lookup is None:
        return None
    if mac in _vendor_cache:
        return _vendor_cache[mac]
    try:
        vendor = _mac_lookup.lookup(mac)
    except Exception:
        vendor = None
    _vendor_cache[mac] = vendor
    return vendor


def upsert_device(ip: str, mac: str) -> None:
    try:
        response = requests.post(
            api_url("/api/detector/devices"),
            json={
                "mac_address": mac,
                "ip_address": ip,
                "vendor": lookup_vendor(mac),
            },
            timeout=5,
        )
        response.raise_for_status()
    except Exception as exc:
        print(f"[ERROR] Failed to update devices: {exc}")


def raise_alert(
    attack_type: str, target_ip: str, real_mac: str, attacker_mac: str
) -> None:
    try:
        response = requests.post(
            api_url("/api/detector/alerts"),
            json={
                "attack_type": attack_type,
                "target_ip": target_ip,
                "real_mac": real_mac,
                "attacker_mac": attacker_mac,
            },
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        print("[DATABASE] Alert logged via local dashboard API.")
        if payload.get("auto_blocked"):
            print(f"[BLOCK] MAC {attacker_mac} auto-blocked on the router.\n")
        else:
            reason = payload.get("skipped_reason") or "unknown"
            print(f"[INFO] Auto-block skipped: {reason}\n")
    except Exception as exc:
        print(f"[ERROR] Failed to log alert: {exc}\n")


def check_ip_mac_mismatch(
    ip: str, mac: str, now: datetime, window_seconds: int
) -> None:
    previous = ip_mac_table.get(ip)

    if previous and previous["mac"] != mac:
        elapsed = (now - previous["last_seen"]).total_seconds()
        if elapsed <= window_seconds:
            real_mac = previous["mac"]
            print(f"\n[WARNING] MAC spoofing detected for IP: {ip}!")
            print(
                f"Real MAC: {real_mac} | Attacker MAC: {mac} "
                f"(changed in {elapsed:.1f}s)"
            )
            raise_alert("ip_mac_mismatch", ip, real_mac, mac)
        else:
            print(
                f"[INFO] IP {ip} moved from MAC {previous['mac']} to {mac} "
                f"after {elapsed:.0f}s — outside the sensitivity window, "
                "treated as normal."
            )

    ip_mac_table[ip] = {"mac": mac, "last_seen": now}


def check_arp_poisoning(
    ip: str, mac: str, now: datetime, window_seconds: int
) -> None:
    seen_ips = mac_ip_table.setdefault(mac, {})

    for old_ip in [
        ip_
        for ip_, ts in seen_ips.items()
        if (now - ts).total_seconds() > window_seconds
    ]:
        del seen_ips[old_ip]

    is_new_ip_for_this_mac = ip not in seen_ips
    seen_ips[ip] = now

    if is_new_ip_for_this_mac and len(seen_ips) >= 2:
        claimed_ips = ", ".join(sorted(seen_ips.keys()))
        print(
            f"\n[WARNING] Possible ARP poisoning: MAC {mac} claims to be "
            f"{len(seen_ips)} different IPs within {window_seconds}s: "
            f"{claimed_ips}"
        )
        raise_alert("arp_poisoning", claimed_ips, "N/A", mac)


def process_packet(packet) -> None:
    # Process both ARP request (op 1) and reply (op 2). On Wi-Fi, a station
    # normally only receives frames addressed to itself plus broadcast/
    # multicast traffic — it does NOT see unicast frames exchanged between
    # two other devices unless the adapter is in monitor mode. ARP requests
    # are broadcast ("who has X? tell Y"), so they're visible from any
    # device on the network; ARP replies are usually unicast straight to
    # the requester, so we'd only see those addressed to us. Handling
    # requests too is what lets other devices (e.g. a tablet) show up.
    if not (packet.haslayer(ARP) and packet[ARP].op in (1, 2)):
        return

    ip = packet[ARP].psrc
    mac = packet[ARP].hwsrc
    now = datetime.now(timezone.utc)

    print(f"[INFO] Active device seen: IP {ip} -> MAC {mac}")
    upsert_device(ip, mac)

    config = get_router_config()
    window_seconds = get_spoof_window_seconds(config)

    check_ip_mac_mismatch(ip, mac, now, window_seconds)
    check_arp_poisoning(ip, mac, now, window_seconds)


def heartbeat_loop(stop_event: threading.Event) -> None:
    hostname = socket.gethostname()
    while not stop_event.is_set():
        try:
            response = requests.post(
                api_url("/api/detector/heartbeat"),
                json={"hostname": hostname},
                timeout=5,
            )
            response.raise_for_status()
        except Exception as exc:
            print(f"[WARN] Heartbeat failed (is npm run dev up?): {exc}")
        stop_event.wait(HEARTBEAT_INTERVAL_SECONDS)


def main() -> None:
    global _api_base

    parser = argparse.ArgumentParser(
        description="Local ARP MAC-spoofing detector"
    )
    parser.add_argument(
        "--api",
        default=DEFAULT_API_BASE,
        help=f"Dashboard base URL (default: {DEFAULT_API_BASE})",
    )
    args = parser.parse_args()
    _api_base = args.api

    stop_event = threading.Event()
    thread = threading.Thread(
        target=heartbeat_loop, args=(stop_event,), daemon=True
    )
    thread.start()

    print(f"[START] Detector talking to {_api_base}")
    print("[INFO] Listening for ARP traffic...")
    try:
        sniff(filter="arp", prn=process_packet, store=0)
    finally:
        stop_event.set()


if __name__ == "__main__":
    main()
