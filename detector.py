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
DEFAULT_SPOOF_WINDOW_SECONDS = 2
DEFAULT_MIN_POISONING_IPS = 3
MIN_OBSERVATIONS_BEFORE_ALERT = 2
HEARTBEAT_INTERVAL_SECONDS = 10

# ip -> {"mac": str, "last_seen": datetime, "hits": int}
ip_mac_table: dict[str, dict] = {}

# mac -> {ip: datetime, ...}
mac_ip_table: dict[str, dict[str, datetime]] = {}

# Local cooldown: (attack_type, attacker_mac, target_ip) -> last alert time
_alert_cooldown: dict[tuple[str, str, str], datetime] = {}

_vendor_cache: dict[str, str | None] = {}
_api_base = DEFAULT_API_BASE
_detection_config: dict = {}


def normalize_mac(mac: str) -> str:
    return mac.replace("-", ":").lower()


def api_url(path: str) -> str:
    return f"{_api_base.rstrip('/')}{path}"


def refresh_detection_config() -> dict:
    global _detection_config
    try:
        response = requests.get(api_url("/api/detector/config"), timeout=5)
        response.raise_for_status()
        _detection_config = response.json()
    except Exception as exc:
        print(f"[ERROR] Failed to read config from dashboard: {exc}")
    return _detection_config


def get_spoof_window_seconds(config: dict) -> int:
    if config and config.get("spoof_window_seconds"):
        try:
            return int(config["spoof_window_seconds"])
        except (TypeError, ValueError):
            pass
    return DEFAULT_SPOOF_WINDOW_SECONDS


def get_min_poisoning_ips(config: dict) -> int:
    if config and config.get("min_poisoning_ips"):
        try:
            return max(2, int(config["min_poisoning_ips"]))
        except (TypeError, ValueError):
            pass
    return DEFAULT_MIN_POISONING_IPS


def get_alert_cooldown_seconds(config: dict) -> int:
    if config and config.get("alert_cooldown_seconds"):
        try:
            return max(30, int(config["alert_cooldown_seconds"]))
        except (TypeError, ValueError):
            pass
    return 300


def get_gateway_ips(config: dict) -> set[str]:
    ips = config.get("gateway_ips") if config else None
    if isinstance(ips, list):
        return {str(ip) for ip in ips}
    return set()


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
    key = (attack_type, normalize_mac(attacker_mac), target_ip)
    now = datetime.now(timezone.utc)
    cooldown = get_alert_cooldown_seconds(_detection_config)
    last = _alert_cooldown.get(key)
    if last and (now - last).total_seconds() < cooldown:
        return

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

        if payload.get("suppressed"):
            print(f"[INFO] Alert suppressed: {payload.get('reason')}")
            return

        _alert_cooldown[key] = now
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
        prev_hits = previous.get("hits", 1)
        if elapsed <= window_seconds and prev_hits >= MIN_OBSERVATIONS_BEFORE_ALERT:
            real_mac = previous["mac"]
            print(f"\n[WARNING] MAC spoofing detected for IP: {ip}!")
            print(
                f"Real MAC: {real_mac} | Attacker MAC: {mac} "
                f"(changed in {elapsed:.1f}s after {prev_hits} stable sightings)"
            )
            raise_alert("ip_mac_mismatch", ip, real_mac, mac)
        elif elapsed <= window_seconds:
            print(
                f"[INFO] IP {ip} flipped MAC too quickly but previous binding "
                f"only seen {prev_hits}x — waiting for stable baseline."
            )
        else:
            print(
                f"[INFO] IP {ip} moved from MAC {previous['mac']} to {mac} "
                f"after {elapsed:.0f}s — outside spoof window, treated as normal."
            )
        ip_mac_table[ip] = {"mac": mac, "last_seen": now, "hits": 1}
        return

    if previous and previous["mac"] == mac:
        previous["last_seen"] = now
        previous["hits"] = previous.get("hits", 1) + 1
        return

    ip_mac_table[ip] = {"mac": mac, "last_seen": now, "hits": 1}


def check_arp_poisoning(
    ip: str,
    mac: str,
    now: datetime,
    window_seconds: int,
    min_ips: int,
    gateway_ips: set[str],
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

    non_gateway_ips = [ip_ for ip_ in seen_ips if ip_ not in gateway_ips]
    if is_new_ip_for_this_mac and len(non_gateway_ips) >= min_ips:
        claimed_ips = ", ".join(sorted(seen_ips.keys()))
        print(
            f"\n[WARNING] Possible ARP poisoning: MAC {mac} claims to be "
            f"{len(non_gateway_ips)} non-gateway IPs within {window_seconds}s: "
            f"{claimed_ips}"
        )
        raise_alert("arp_poisoning", claimed_ips, "N/A", mac)


def process_packet(packet) -> None:
    if not (packet.haslayer(ARP) and packet[ARP].op in (1, 2)):
        return

    ip = packet[ARP].psrc
    mac = normalize_mac(packet[ARP].hwsrc)
    now = datetime.now(timezone.utc)

    print(f"[INFO] Active device seen: IP {ip} -> MAC {mac}")
    upsert_device(ip, mac)

    config = refresh_detection_config()
    window_seconds = get_spoof_window_seconds(config)
    min_ips = get_min_poisoning_ips(config)
    gateway_ips = get_gateway_ips(config)

    check_ip_mac_mismatch(ip, mac, now, window_seconds)
    check_arp_poisoning(ip, mac, now, window_seconds, min_ips, gateway_ips)


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
            refresh_detection_config()
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
    refresh_detection_config()

    stop_event = threading.Event()
    thread = threading.Thread(
        target=heartbeat_loop, args=(stop_event,), daemon=True
    )
    thread.start()

    print(f"[START] Detector talking to {_api_base}")
    print(
        "[INFO] Strict mode: spoof window "
        f"{get_spoof_window_seconds(_detection_config)}s, "
        f"min poisoning IPs {get_min_poisoning_ips(_detection_config)}, "
        f"cooldown {get_alert_cooldown_seconds(_detection_config)}s"
    )
    print("[INFO] Listening for ARP traffic...")
    try:
        sniff(filter="arp", prn=process_packet, store=0)
    finally:
        stop_event.set()


if __name__ == "__main__":
    main()
