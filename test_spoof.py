"""
Lab helper: intentionally emit a fake ARP reply so you can verify that
detector.py raises an alert on the local dashboard.

Usage:
1. Start the dashboard: npm run dev
2. Start the detector (Administrator terminal): python detector.py
3. Set TARGET_IP to an IP already listed under Devices.
4. Run this script as Administrator: python test_spoof.py
5. Check the detector terminal and the Alerts page.
"""

import random

from scapy.all import ARP, Ether, sendp

# Change to an IP that already appears on the Devices page, for example:
TARGET_IP = "192.168.1.10"

fake_mac = "de:ad:be:ef:%02x:%02x" % (
    random.randint(0, 255),
    random.randint(0, 255),
)

print(
    f"[TEST] Sending fake ARP reply: IP {TARGET_IP} claimed by MAC {fake_mac}"
)

packet = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(
    op=2,
    psrc=TARGET_IP,
    hwsrc=fake_mac,
)

sendp(packet, count=3, inter=0.2, verbose=True)

print(
    "[TEST] Done. Check the detector terminal and the Alerts page in the dashboard."
)
