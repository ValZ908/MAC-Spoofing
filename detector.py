import os
from datetime import datetime, timezone

import paramiko
from scapy.all import sniff, ARP
from supabase import create_client, Client
from dotenv import load_dotenv

try:
    from mac_vendor_lookup import MacLookup
    _mac_lookup = MacLookup()
except ImportError:
    _mac_lookup = None
    print("[WARN] mac_vendor_lookup not installed, Vendor column will stay empty. "
          "Run: pip install mac-vendor-lookup")

load_dotenv(dotenv_path=".env.local")

url: str = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# Service role key (not anon key): alerts/router_config have RLS that only
# allows "authenticated" to read/update, no insert policy for anon. This
# script runs locally/trusted, so it needs the service role key to read
# router config and insert alerts/devices.
key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("[ERROR] Supabase env vars not found in .env.local!")
    exit(1)

supabase: Client = create_client(url, key)

# ip -> {"mac": str, "last_seen": datetime}
# Used for detection #1: same IP suddenly claimed by a different MAC.
ip_mac_table: dict[str, dict] = {}

# mac -> {ip: datetime, ...}
# Used for detection #2 (classic ARP poisoning): one MAC claiming several
# different IPs within a short window (e.g. attacker answering ARP for
# both the gateway and a victim).
mac_ip_table: dict[str, dict[str, datetime]] = {}

DEFAULT_SPOOF_WINDOW_SECONDS = 5
_vendor_cache: dict[str, str | None] = {}


def get_router_config():
    """Read router credentials, block command, and sensitivity from Settings."""
    result = supabase.table("router_config").select("*").limit(1).single().execute()
    return result.data


def get_spoof_window_seconds(config) -> int:
    """Read 'Sensitivity (seconds)' from Settings, falling back to a default."""
    if config and config.get("spoof_window_seconds"):
        try:
            return int(config["spoof_window_seconds"])
        except (TypeError, ValueError):
            pass
    return DEFAULT_SPOOF_WINDOW_SECONDS


def lookup_vendor(mac: str) -> str | None:
    """Look up vendor from the MAC's OUI (first 3 bytes). Cached per MAC."""
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


def block_attacker_on_router(config, attacker_mac: str):
    """SSH into the router and run the block command. Returns (success, error_message)."""
    if not config or not config.get("router_ip"):
        return False, "Router not configured on the Settings page."

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
    """Record/update a device so it shows up on the Devices page."""
    try:
        supabase.table("devices").upsert(
            {
                "mac_address": mac,
                "ip_address": ip,
                "vendor": lookup_vendor(mac),
                "status": "active",
                "last_seen": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="mac_address",
        ).execute()
    except Exception as e:
        print(f"[ERROR] Failed to update devices table: {e}")


def raise_alert(attack_type: str, target_ip: str, real_mac: str, attacker_mac: str):
    """Insert an alert into Supabase, then try to auto-block. Shared by both checks."""
    alert_id = None
    try:
        data = {
            "attack_type": attack_type,
            "target_ip": target_ip,
            "real_mac": real_mac,
            "attacker_mac": attacker_mac,
            "status": "unhandled",
        }
        result = supabase.table("alerts").insert(data).execute()
        alert_id = result.data[0]["id"]
        print("[DATABASE] Alert logged to Supabase.")
    except Exception as e:
        print(f"[ERROR] Failed to log alert to Supabase: {e}\n")

    try:
        config = get_router_config()
    except Exception as e:
        config = None
        print(f"[ERROR] Failed to read router config: {e}\n")

    success, error = block_attacker_on_router(config, attacker_mac)
    if success:
        print(f"[BLOCK] MAC {attacker_mac} auto-blocked on the router.\n")
        if alert_id:
            try:
                supabase.table("alerts").update({"status": "blocked"}).eq("id", alert_id).execute()
            except Exception as e:
                print(f"[ERROR] Failed to update alert status: {e}\n")
    else:
        print(f"[ERROR] Auto-block failed: {error}\n")
        print("[INFO] Alert stays 'unhandled', can be blocked manually from the website.\n")


def check_ip_mac_mismatch(ip: str, mac: str, now: datetime, window_seconds: int):
    """Detection #1: same IP suddenly claimed by a different MAC.

    A change slower than `window_seconds` (e.g. router handing out a new
    DHCP lease hours later) is treated as normal, just updates the table.
    """
    previous = ip_mac_table.get(ip)

    if previous and previous["mac"] != mac:
        elapsed = (now - previous["last_seen"]).total_seconds()
        if elapsed <= window_seconds:
            real_mac = previous["mac"]
            print(f"\n[WARNING] MAC spoofing detected for IP: {ip}!")
            print(f"Real MAC: {real_mac} | Attacker MAC: {mac} (changed in {elapsed:.1f}s)")
            raise_alert("ip_mac_mismatch", ip, real_mac, mac)
        else:
            print(f"[INFO] IP {ip} moved from MAC {previous['mac']} to {mac} "
                  f"after {elapsed:.0f}s — outside the sensitivity window, treated as normal.")

    ip_mac_table[ip] = {"mac": mac, "last_seen": now}


def check_arp_poisoning(ip: str, mac: str, now: datetime, window_seconds: int):
    """Detection #2: one MAC claiming more than one IP within a short window.

    This is the classic ARP poisoning pattern (e.g. attacker answers ARP
    for both the gateway and a victim so both flow through it).
    """
    seen_ips = mac_ip_table.setdefault(mac, {})

    # Drop entries older than the sensitivity window.
    for old_ip in [ip_ for ip_, ts in seen_ips.items() if (now - ts).total_seconds() > window_seconds]:
        del seen_ips[old_ip]

    is_new_ip_for_this_mac = ip not in seen_ips
    seen_ips[ip] = now

    if is_new_ip_for_this_mac and len(seen_ips) >= 2:
        claimed_ips = ", ".join(sorted(seen_ips.keys()))
        print(f"\n[WARNING] Possible ARP poisoning: MAC {mac} claims to be "
              f"{len(seen_ips)} different IPs within {window_seconds}s: {claimed_ips}")
        raise_alert("arp_poisoning", claimed_ips, "N/A", mac)


def process_packet(packet):
    if not (packet.haslayer(ARP) and packet[ARP].op == 2):  # ARP reply only
        return

    ip = packet[ARP].psrc
    mac = packet[ARP].hwsrc
    now = datetime.now(timezone.utc)

    print(f"[INFO] Active device seen: IP {ip} -> MAC {mac}")
    upsert_device(ip, mac)

    try:
        config = get_router_config()
    except Exception as e:
        config = None
        print(f"[ERROR] Failed to read sensitivity config: {e}\n")

    window_seconds = get_spoof_window_seconds(config)

    check_ip_mac_mismatch(ip, mac, now, window_seconds)
    check_arp_poisoning(ip, mac, now, window_seconds)


print("[START] Detector script running, monitoring local network...")
print("[INFO] Listening for ARP traffic... trigger some by browsing from another device on the network.")

# Don't pass verbose=... here: scapy 2.7 forwards unknown kwargs straight
# to the L2 socket constructor, which doesn't accept "verbose" and crashes
# with a TypeError.
sniff(filter="arp", prn=process_packet, store=0)