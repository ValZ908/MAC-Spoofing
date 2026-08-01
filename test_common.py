"""Shared helpers for test_spoof.py and test_arp_poisoning.py."""

from __future__ import annotations

import os
import random
import sys
import time
from datetime import datetime, timezone

import requests
from scapy.all import ARP, Ether, sendp

from scapy_iface import resolve_iface

DEFAULT_API = os.environ.get("DASHBOARD_API", "http://127.0.0.1:3000")
HEARTBEAT_STALE_SECONDS = 25
VERIFY_TIMEOUT_SECONDS = 25


def api_url(path: str, base: str = DEFAULT_API) -> str:
    return f"{base.rstrip('/')}{path}"


def normalize_mac(mac: str) -> str:
    return mac.replace("-", ":").lower()


def random_fake_mac() -> str:
    return "de:ad:be:ef:%02x:%02x" % (random.randint(0, 255), random.randint(0, 255))


def broadcast_arp_reply(
    ip: str, mac: str, count: int = 1, iface: str | None = None
) -> None:
    """Send gratuitous ARP on the LAN-facing interface (reply + request)."""
    send_iface = iface or resolve_iface(ip)
    kwargs: dict = {"inter": 0.08, "verbose": False}
    if send_iface:
        kwargs["iface"] = send_iface

    for _ in range(count):
        reply = (
            Ether(src=mac, dst="ff:ff:ff:ff:ff:ff")
            / ARP(op=2, pdst=ip, psrc=ip, hwdst="ff:ff:ff:ff:ff:ff", hwsrc=mac)
        )
        sendp(reply, **kwargs)
        request = (
            Ether(src=mac, dst="ff:ff:ff:ff:ff:ff")
            / ARP(op=1, pdst=ip, psrc=ip, hwsrc=mac)
        )
        sendp(request, **kwargs)


def send_poisoning_burst(
    ips: list[str], mac: str, iface: str | None = None, rounds: int = 3
) -> None:
    """Send several tight rounds so detector sees every IP for the same MAC."""
    send_iface = iface or resolve_iface(ips[0] if ips else None)
    for _ in range(rounds):
        for ip in ips:
            broadcast_arp_reply(ip, mac, count=1, iface=send_iface)
        time.sleep(0.12)


def fetch_json(path: str, base: str = DEFAULT_API) -> object:
    response = requests.get(api_url(path, base), timeout=8)
    response.raise_for_status()
    return response.json()


def ensure_prerequisites(base: str = DEFAULT_API) -> tuple[list[dict], dict]:
    try:
        status = fetch_json("/api/status", base)
    except Exception as exc:
        print(f"[FAIL] Cannot reach dashboard at {base}: {exc}")
        print("       Start it first: npm run dev")
        sys.exit(1)

    heartbeat = status.get("lastHeartbeat") if isinstance(status, dict) else None
    if not heartbeat:
        print("[FAIL] Detector has never reported in.")
        print("       Start the dashboard as Administrator (Settings → Built-in Detector).")
        sys.exit(1)

    last_seen = datetime.fromisoformat(
        str(heartbeat["last_seen"]).replace("Z", "+00:00")
    )
    age = (datetime.now(timezone.utc) - last_seen).total_seconds()
    if age > HEARTBEAT_STALE_SECONDS:
        print(f"[FAIL] Detector is offline (last heartbeat {age:.0f}s ago).")
        print("       Start the dashboard as Administrator (Settings → Built-in Detector).")
        sys.exit(1)

    try:
        devices = fetch_json("/api/devices", base)
        config = fetch_json("/api/detector/config", base)
    except requests.HTTPError as exc:
        print(f"[FAIL] Dashboard API error: {exc}")
        print("       Restart npm run dev (needs /api/devices and /api/alerts).")
        sys.exit(1)

    if not isinstance(devices, list) or not isinstance(config, dict):
        print("[FAIL] Unexpected API response from dashboard.")
        sys.exit(1)

    return devices, config


def pick_spoof_target(devices: list[dict], config: dict) -> tuple[str, str]:
    gateway_ips = {str(ip) for ip in config.get("gateway_ips", [])}
    candidates = [
        d
        for d in devices
        if d.get("status") == "active"
        and d.get("ip_address")
        and d.get("mac_address")
        and str(d["ip_address"]) not in gateway_ips
    ]
    if not candidates:
        print("[FAIL] No active non-gateway device on the Devices page.")
        print("       Wait for the built-in detector to see traffic, or use --target-ip.")
        sys.exit(1)

    device = candidates[0]
    return str(device["ip_address"]), normalize_mac(str(device["mac_address"]))


def pick_poisoning_targets(devices: list[dict], config: dict) -> list[str]:
    min_ips = max(2, int(config.get("min_poisoning_ips", 3)))
    gateway_ips = {str(ip) for ip in config.get("gateway_ips", [])}
    ips = [
        str(d["ip_address"])
        for d in devices
        if d.get("status") == "active"
        and d.get("ip_address")
        and str(d["ip_address"]) not in gateway_ips
    ]
    ips = list(dict.fromkeys(ips))
    if len(ips) < min_ips:
        print(
            f"[FAIL] ARP poisoning needs {min_ips} active non-gateway IP(s); "
            f"found {len(ips)}: {', '.join(ips) or '(none)'}"
        )
        print("       Connect more devices to WiFi, or set Min IPs to 2 in Settings.")
        sys.exit(1)
    return ips[:min_ips]


def latest_alert_of_type(
    attack_type: str, base: str = DEFAULT_API
) -> dict | None:
    try:
        alerts = fetch_json("/api/alerts", base)
        if not isinstance(alerts, list):
            return None
        for alert in alerts:
            if alert.get("attack_type") == attack_type:
                return alert
    except Exception:
        pass
    return None


def parse_alert_time(value: str) -> datetime:
    text = str(value).replace("Z", "+00:00")
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def wait_for_alert(
    attack_type: str,
    attacker_mac: str,
    *,
    target_ip: str | None = None,
    base: str = DEFAULT_API,
    timeout: float = VERIFY_TIMEOUT_SECONDS,
) -> dict | None:
    attacker = normalize_mac(attacker_mac)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            alerts = fetch_json("/api/alerts", base)
            if isinstance(alerts, list):
                for alert in alerts:
                    if alert.get("attack_type") != attack_type:
                        continue
                    if normalize_mac(str(alert.get("attacker_mac", ""))) != attacker:
                        continue
                    if target_ip and target_ip not in str(alert.get("target_ip", "")):
                        continue
                    created = parse_alert_time(str(alert["created_at"]))
                    if (datetime.now(timezone.utc) - created).total_seconds() <= 300:
                        return alert
        except Exception:
            pass
        time.sleep(1)
    return None
