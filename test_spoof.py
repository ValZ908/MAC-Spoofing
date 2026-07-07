"""
Skrip TEST untuk memicu alert MAC spoofing secara sengaja, di jaringan
sendiri, supaya bisa memverifikasi detector.py benar-benar mendeteksinya.

Cara pakai:
1. Pastikan detector.py sudah berjalan (di terminal Administrator lain).
2. Ganti TARGET_IP di bawah dengan salah satu IP yang sudah muncul di
   halaman Devices (harus IP yang SUDAH pernah terdeteksi sebelumnya).
3. Jalankan skrip ini juga sebagai Administrator:
     python test_spoof.py
4. Lihat terminal detector.py: seharusnya muncul "[BAHAYA!] MAC Spoofing
   Terdeteksi", dan alert baru muncul di halaman Alerts pada website.
"""

from scapy.all import ARP, Ether, sendp
import random

# Ganti dengan IP yang sudah terdeteksi di halaman Devices, misalnya:
TARGET_IP = "172.18.252.34"

fake_mac = "de:ad:be:ef:%02x:%02x" % (random.randint(0, 255), random.randint(0, 255))

print(f"[TEST] Mengirim ARP reply palsu: IP {TARGET_IP} sekarang diklaim oleh MAC {fake_mac}")

packet = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(
    op=2,  # ARP reply
    psrc=TARGET_IP,
    hwsrc=fake_mac,
)

sendp(packet, count=3, inter=0.2, verbose=True)

print("[TEST] Selesai mengirim. Cek terminal detector.py dan halaman Alerts di website.")
