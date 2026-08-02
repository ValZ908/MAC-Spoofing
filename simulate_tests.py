"""
Dashboard simulation & attack-lab runner.

No Scapy / Administrator required for `demo` mode — only `npm run dev` must be up.
`spoof` and `poison` send real ARP frames (Administrator + Npcap).

Examples:
  python simulate_tests.py demo
  python simulate_tests.py status
  python simulate_tests.py spoof
  python simulate_tests.py poison
  python simulate_tests.py all --api http://127.0.0.1:3000
"""

from __future__ import annotations

import argparse
import random
import sys
import time

import requests

from test_common import (
    DEFAULT_API,
    api_url,
    broadcast_arp_reply,
    ensure_prerequisites,
    fetch_json,
    pick_poisoning_targets,
    pick_spoof_target,
    random_fake_mac,
    send_poisoning_burst,
    wait_for_alert,
)

# Fake lab devices shown on the Devices page (demo mode).
DEMO_DEVICES: list[tuple[str, str, str | None]] = [
    ("10.10.0.105", "aa:bb:cc:11:22:01", "Demo Phone"),
    ("10.10.0.106", "aa:bb:cc:11:22:02", "Demo Laptop"),
    ("10.10.0.107", "aa:bb:cc:11:22:03", "Demo Tablet"),
    ("10.10.0.108", "aa:bb:cc:11:22:04", "Demo IoT"),
]


def post_json(
    path: str, payload: dict, base: str = DEFAULT_API, timeout: float = 15
) -> dict:
    response = requests.post(api_url(path, base), json=payload, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {"result": data}


def cmd_status(base: str) -> int:
    print(f"[INFO] Dashboard: {base}")
    try:
        status = fetch_json("/api/status", base)
    except Exception as exc:
        print(f"[FAIL] Cannot reach dashboard: {exc}")
        print("       Start: npm run dev")
        return 1

    if not isinstance(status, dict):
        print("[FAIL] Unexpected /api/status response.")
        return 1

    hb = status.get("lastHeartbeat")
    if hb:
        print(f"[OK]   Detector heartbeat: {hb.get('hostname')} @ {hb.get('last_seen')}")
    else:
        print("[WARN] No detector heartbeat yet (run demo or start detector.py).")

    print(
        f"[INFO] Devices: {status.get('activeDeviceCount', 0)} active, "
        f"Alerts: {status.get('unhandledCount', 0)} unhandled"
    )
    return 0


def cmd_demo(base: str) -> int:
    print(f"[DEMO] Seeding dashboard at {base} (HTTP only, no ARP packets)")

    try:
        post_json("/api/detector/heartbeat", {"hostname": "simulate-demo"}, base)
        print("[OK]   Detector marked online (simulate-demo)")
    except Exception as exc:
        print(f"[FAIL] Heartbeat: {exc}")
        return 1

    for ip, mac, vendor in DEMO_DEVICES:
        try:
            post_json(
                "/api/detector/devices",
                {"ip_address": ip, "mac_address": mac, "vendor": vendor},
                base,
            )
            print(f"[OK]   Device  {ip}  {mac}")
        except Exception as exc:
            print(f"[WARN] Device {ip}: {exc}")

    attacker_spoof = random_fake_mac()
    try:
        result = post_json(
            "/api/detector/alerts",
            {
                "attack_type": "ip_mac_mismatch",
                "target_ip": DEMO_DEVICES[0][0],
                "real_mac": DEMO_DEVICES[0][1],
                "attacker_mac": attacker_spoof,
            },
            base,
            timeout=60,
        )
        if result.get("suppressed"):
            print(f"[WARN] Spoof alert suppressed: {result.get('reason')}")
        else:
            print(f"[OK]   Alert   ip_mac_mismatch  attacker {attacker_spoof}")
    except Exception as exc:
        print(f"[FAIL] Spoof alert: {exc}")
        return 1

    attacker_poison = random_fake_mac()
    poison_ips = ",".join(ip for ip, _, _ in DEMO_DEVICES[:3])
    try:
        result = post_json(
            "/api/detector/alerts",
            {
                "attack_type": "arp_poisoning",
                "target_ip": poison_ips,
                "real_mac": DEMO_DEVICES[0][1],
                "attacker_mac": attacker_poison,
            },
            base,
            timeout=60,
        )
        if result.get("suppressed"):
            print(f"[WARN] Poison alert suppressed: {result.get('reason')}")
        else:
            print(f"[OK]   Alert   arp_poisoning   attacker {attacker_poison}")
    except Exception as exc:
        print(f"[FAIL] Poison alert: {exc}")
        return 1

    print()
    print("[DONE] Open the dashboard:")
    print(f"       {base.rstrip('/')}/")
    print(f"       {base.rstrip('/')}/devices")
    print(f"       {base.rstrip('/')}/alerts")
    return 0


def cmd_spoof(base: str, target_ip: str | None, rounds: int) -> int:
    devices, config = ensure_prerequisites(base)
    if target_ip:
        match = next(
            (d for d in devices if str(d.get("ip_address")) == target_ip),
            None,
        )
        if not match or not match.get("mac_address"):
            print(f"[FAIL] --target-ip {target_ip} not found on Devices page.")
            return 1
        ip = target_ip
        real_mac = str(match["mac_address"])
    else:
        ip, real_mac = pick_spoof_target(devices, config)

    attacker = random_fake_mac()
    print(f"[SPOOF] IP {ip}  real {real_mac}  fake {attacker}  x{rounds}")

    for i in range(rounds):
        broadcast_arp_reply(ip, attacker, count=2)
        time.sleep(0.25)
        print(f"       burst {i + 1}/{rounds} sent")

    alert = wait_for_alert("ip_mac_mismatch", attacker, target_ip=ip, base=base)
    if alert:
        print(f"[OK]   Alert logged: {alert.get('id')}  status={alert.get('status')}")
        return 0

    print("[WARN] No matching alert within timeout — check Settings spoof window.")
    print("       Alerts page may still update after a few seconds.")
    return 0


def cmd_poison(base: str, rounds: int) -> int:
    devices, config = ensure_prerequisites(base)
    ips = pick_poisoning_targets(devices, config)
    attacker = random_fake_mac()

    print(f"[POISON] MAC {attacker} claims: {', '.join(ips)}")

    send_poisoning_burst(ips, attacker, rounds=rounds)

    alert = wait_for_alert(
        "arp_poisoning",
        attacker,
        target_ip=ips[0],
        base=base,
    )
    if alert:
        print(f"[OK]   Alert logged: {alert.get('id')}  status={alert.get('status')}")
        return 0

    print("[WARN] No matching alert within timeout.")
    print("       Try lowering Min IPs for ARP poisoning in Settings, or add more devices.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Simulate attacks or seed demo data for the MAC-spoofing dashboard."
    )
    parser.add_argument(
        "--api",
        default=DEFAULT_API,
        help=f"Dashboard base URL (default: {DEFAULT_API})",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status", help="Check dashboard + detector heartbeat")

    sub.add_parser(
        "demo",
        help="HTTP-only demo: fake devices + alerts (no Administrator)",
    )

    spoof_p = sub.add_parser(
        "spoof",
        help="Send fake ARP for IP/MAC mismatch (Administrator + Npcap)",
    )
    spoof_p.add_argument("--target-ip", help="Victim IP from Devices page")
    spoof_p.add_argument("--rounds", type=int, default=5, help="ARP burst count")

    poison_p = sub.add_parser(
        "poison",
        help="Send ARP poisoning burst (Administrator + Npcap)",
    )
    poison_p.add_argument("--rounds", type=int, default=4, help="Burst rounds")

    all_p = sub.add_parser("all", help="Run demo, then spoof + poison if detector is up")
    all_p.add_argument("--skip-network", action="store_true", help="Only run demo")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    base: str = args.api

    if args.command == "status":
        return cmd_status(base)
    if args.command == "demo":
        return cmd_demo(base)
    if args.command == "spoof":
        return cmd_spoof(base, args.target_ip, args.rounds)
    if args.command == "poison":
        return cmd_poison(base, args.rounds)
    if args.command == "all":
        code = cmd_demo(base)
        if code != 0:
            return code
        if args.skip_network:
            return 0
        print()
        try:
            ensure_prerequisites(base)
        except SystemExit:
            print("[INFO] Skipping network tests (detector offline). Demo data is ready.")
            return 0
        code = cmd_spoof(base, None, 5)
        print()
        code2 = cmd_poison(base, 4)
        return code or code2

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
