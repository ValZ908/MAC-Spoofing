import os
from datetime import datetime, timezone

import paramiko
from scapy.all import sniff, ARP
from supabase import create_client, Client
from dotenv import load_dotenv

# Membaca konfigurasi dari file .env.local bawaan Next.js Anda
load_dotenv(dotenv_path=".env.local")

url: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# Pakai service role key, bukan anon key: tabel `alerts`/`router_config`
# punya Row Level Security yang hanya mengizinkan role "authenticated" untuk
# baca/update, tidak ada policy insert untuk anon. Detector ini jalan
# lokal/terpercaya, jadi service role key (bypass RLS) yang seharusnya
# dipakai untuk baca konfigurasi router dan insert alert/device.
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("[ERROR] Variabel Supabase tidak ditemukan di .env.local!")
    exit(1)

supabase: Client = create_client(url, key)
ip_mac_table = {}


def get_router_config():
    """Ambil kredensial & template perintah block dari halaman Settings di website."""
    result = supabase.table("router_config").select("*").limit(1).single().execute()
    return result.data


def block_attacker_on_router(config, attacker_mac: str):
    """SSH langsung ke router dan jalankan perintah block. Return (sukses, pesan_error)."""
    if not config or not config.get("router_ip"):
        return False, "Router belum dikonfigurasi di halaman Settings."

    command = config["block_command_template"].replace("{mac}", attacker_mac)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(
            hostname=config["router_ip"],
            username=config["username"],
            password=config["password"],
            timeout=10,
        )
        _, stdout, stderr = client.exec_command(command)
        exit_code = stdout.channel.recv_exit_status()
        if exit_code == 0:
            return True, ""
        return False, stderr.read().decode() or f"Router command exited with code {exit_code}"
    except Exception as e:
        return False, str(e)
    finally:
        client.close()


def upsert_device(ip: str, mac: str):
    """Catat/perbarui perangkat yang terlihat di jaringan supaya muncul di halaman Devices."""
    try:
        supabase.table("devices").upsert(
            {
                "mac_address": mac,
                "ip_address": ip,
                "status": "active",
                "last_seen": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="mac_address",
        ).execute()
    except Exception as e:
        print(f"[ERROR] Gagal update tabel devices: {e}")


def process_packet(packet):
    if packet.haslayer(ARP) and packet[ARP].op == 2:  # ARP Response
        ip = packet[ARP].psrc
        mac = packet[ARP].hwsrc

        print(f"[INFO] Terdeteksi perangkat aktif: IP {ip} -> MAC {mac}")
        upsert_device(ip, mac)

        # Deteksi jika ada IP yang sama tapi MAC Address-nya berubah tiba-tiba
        if ip in ip_mac_table and ip_mac_table[ip] != mac:
            real_mac = ip_mac_table[ip]
            print(f"\n[⚠️ BAHAYA!] MAC Spoofing Terdeteksi untuk IP: {ip}!")
            print(f"MAC Valid: {real_mac} | MAC Penyerang: {mac}")

            alert_id = None
            try:
                data = {
                    "target_ip": ip,
                    "real_mac": real_mac,
                    "attacker_mac": mac,
                    "status": "unhandled",
                }
                result = supabase.table("alerts").insert(data).execute()
                alert_id = result.data[0]["id"]
                print("[DATABASE] Log alert berhasil dikirim ke Supabase!")
            except Exception as e:
                print(f"[ERROR] Gagal mengirim log ke Supabase: {e}\n")

            # Auto-block: langsung blokir penyerang lewat SSH ke router,
            # tanpa menunggu admin klik tombol "Block Attacker" di website.
            try:
                config = get_router_config()
            except Exception as e:
                config = None
                print(f"[ERROR] Gagal membaca konfigurasi router: {e}\n")

            success, error = block_attacker_on_router(config, mac)
            if success:
                print(f"[BLOCK] MAC {mac} berhasil diblokir otomatis di router.\n")
                if alert_id:
                    try:
                        supabase.table("alerts").update(
                            {"status": "blocked"}
                        ).eq("id", alert_id).execute()
                    except Exception as e:
                        print(f"[ERROR] Gagal update status alert: {e}\n")
            else:
                print(f"[ERROR] Auto-block gagal: {error}\n")
                print("[INFO] Alert tetap berstatus 'unhandled', bisa diblokir manual dari website.\n")
        else:
            ip_mac_table[ip] = mac


print("[START] Skrip detector mulai berjalan memantau jaringan lokal...")
print("[INFO] Sedang mendengarkan lalu lintas ARP... Silakan buka browser di HP/Laptop lain untuk memicu paket data.")

# Jangan tambahkan verbose=... di sini: scapy 2.7 meneruskan kwarg yang
# tidak dikenali langsung ke constructor socket L2, dan socket itu tidak
# menerima "verbose" sehingga akan crash dengan TypeError.
sniff(filter="arp", prn=process_packet, store=0)
