"""
Lab helper: simulate ARP poisoning by having ONE fake MAC claim to be TWO
different IPs within the detector's sensitivity window — the classic
Man-in-the-Middle pattern (impersonating both a victim device and the
gateway at once, to sit between them and intercept traffic).

Usage:
1. Start the dashboard: npm run dev
2. Start the detector (Administrator terminal): python detector.py
3. Set IP_ONE / IP_TWO below to two IPs already listed under Devices
   (e.g. the gateway's IP and one other device's IP).
4. Run this script as Administrator: python test_arp_poisoning.py
5. Check the detector terminal and the Alerts page.
"""

import random

from scapy.all import ARP, Ether, sendp

# Change these to two IPs that already appear on the Devices page.
IP_ONE = "10.42.211.127"
IP_TWO = "10.42.211.226"

fake_mac = "de:ad:be:ef:%02x:%02x" % (
    random.randint(0, 255),
    random.randint(0, 255),
)

print(
    f"[TEST] Simulating ARP poisoning: MAC {fake_mac} claiming to be "
    f"BOTH {IP_ONE} and {IP_TWO}"
)

for ip in (IP_ONE, IP_TWO):
    packet = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(op=2, psrc=ip, hwsrc=fake_mac)
    sendp(packet, count=1, verbose=True)

print(
    "[TEST] Done. Check the detector terminal and the Alerts page in the dashboard."
)
