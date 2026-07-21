# Network Security Center

A self-contained Windows tool for detecting **MAC address spoofing** and **ARP poisoning** on your local network, blocking attackers, and protecting this machine's own network identity. Everything runs locally — no cloud account, no external database, no `.env` file required.

It's made of two parts that talk to each other over HTTP on `localhost`:

- **The dashboard** — a Next.js web app (`npm run dev`) that stores everything in a local SQLite database and gives you a UI to see devices, alerts, and settings.
- **The detector** — a Python script (`detector.py`) that sniffs ARP traffic on your network and reports what it sees to the dashboard.

## Features

| Feature | What it does |
|---|---|
| Device tracking | Every device seen on the network (IP, MAC, vendor) shows up on the Devices page |
| IP/MAC mismatch detection | Flags when the same IP suddenly appears with a different MAC — the signature of an attacker impersonating a device |
| ARP poisoning detection | Flags when the same MAC claims to be multiple different IPs at once — the signature of a Man-in-the-Middle attack |
| Auto-block | SSHes into your router and runs a block command against the attacker's MAC (requires a router with SSH access, e.g. OpenWrt/DD-WRT) |
| Disconnect / Trust | Manually block a device's MAC, or mark it as trusted so it's excluded from suspicion |
| Identity — Rotate | Randomizes this machine's own adapter MAC address (privacy: harder for networks to track you across visits) |
| Identity — Lock | Pins this machine's adapter to its real hardware MAC — any attempt to change it (by malware, other software, or accident) is automatically reverted |
| Identity — Gateway Protection | Pins your router/gateway's MAC in this machine's ARP table, so this machine can't be tricked into trusting a fake gateway (the core defense against ARP-based Man-in-the-Middle attacks) |
| Detector heartbeat | The dashboard shows whether `detector.py` is currently online |

## Requirements

- Windows 10/11
- Node.js 20+
- Python 3.10+
- [Npcap](https://npcap.com/) (required by Scapy for packet capture)
- Administrator privileges — needed for ARP sniffing, changing adapter MAC addresses, and pinning gateway MACs
- Optional: a router with SSH access (e.g. OpenWrt/DD-WRT) if you want auto-block to actually work. Most stock ISP routers and phone hotspots do **not** support this.

## Setup

```bash
# 1. Install JS dependencies
npm install

# 2. Install Python dependencies
pip install -r requirements.txt
```

## Running it

You'll want **two Administrator terminals** open at the same time.

**Terminal 1 — the dashboard:**

```bash
npm run dev
```

This creates `data/app.db` automatically on first run. Open [http://localhost:3000](http://localhost:3000) — there's no login, it opens straight to the Dashboard.

**Terminal 2 — the detector:**

```bash
python detector.py
```

By default it talks to `http://127.0.0.1:3000`. If the dashboard runs on a different host/port, override it:

```bash
python detector.py --api http://127.0.0.1:3000
```

Once it's running, the Settings page's "Detector Agent" status should flip to **Online** within about 10 seconds (it sends a heartbeat every 10s).

Run both terminals **as Administrator**:
- The detector needs it for raw packet capture (ARP sniffing).
- The dashboard needs it for Identity Lock/Rotate and Gateway Protection, which change adapter settings and ARP entries via PowerShell/`netsh`.

## Testing it

With both terminals running, open a **third Administrator terminal** for these:

**Simulate an IP/MAC mismatch attack** (one IP suddenly claimed by a different MAC):

```bash
# Edit TARGET_IP in test_spoof.py to an IP already listed under Devices first
python test_spoof.py
```

**Simulate ARP poisoning** (one MAC claiming to be two different IPs — e.g. a victim device and the gateway):

```bash
# Edit IP_ONE / IP_TWO in test_arp_poisoning.py to two IPs already listed under Devices first
python test_arp_poisoning.py
```

Either way, check the detector's terminal output and the dashboard's Alerts page — you should see the alert appear in real time.

## Settings

Fill in **Settings** with your router's IP, SSH credentials, and a block command if you have an SSH-capable router. Use `{mac}` as a placeholder for the attacker's MAC address, e.g.:

```text
iptables -A FORWARD -m mac --mac-source {mac} -j DROP
```

**Sensitivity (seconds)** controls how tight the detection window is: if a device's MAC changes within this many seconds of it last being seen, it's flagged as spoofing; slower changes are treated as a normal reconnect (DHCP renewal, device switching networks, etc.). A short window (e.g. 5s) catches real attacks with fewer false positives but can miss slower attacks; a wider window (e.g. 30s) catches more but is more prone to flagging legitimate device changes too.

## Identity page

- **Active Adapters**: every network adapter on this machine. **Rotate Now** assigns it a fresh random MAC. **Lock** reverts it to its real hardware MAC and prevents further changes (a background watchdog checks every 15 seconds and reverts + logs anything that tries to change a locked adapter).
- **Gateway Protection**: auto-detects your current default gateway and its MAC. **Pin Gateway MAC** adds a static ARP entry so this machine will always trust that MAC for the gateway's IP, regardless of what ARP replies claim otherwise — the standard defense against ARP spoofing targeting your router.
- **Security Log**: a running history of every unauthorized change the watchdog has caught and reverted. Has a **Clear** button so it doesn't grow forever.

## Known limitations

- **Auto-block only works with SSH-capable routers.** Stock ISP routers, most consumer mesh systems, and phone hotspots don't expose SSH — the Block Attacker / Disconnect buttons will fail with a clear error message on those, but detection and alerting still work fine regardless.
- **Wi-Fi visibility is limited by design.** A Wi-Fi adapter in normal (non-monitor) mode only receives frames addressed to itself plus broadcast/multicast traffic — it can't see unicast ARP replies exchanged between two *other* devices. The detector compensates by also processing ARP requests (which are broadcast), but if the network has AP/client isolation enabled, even that can be blocked.
- **No multi-user auth.** This is a single-admin local tool by design — anyone who can reach `http://localhost:3000` (or this machine's LAN IP) has full control, including the ability to run SSH commands against your configured router. Don't expose it to untrusted networks.

## Data

Everything is stored locally in `data/app.db` (SQLite, created automatically, git-ignored). Delete that folder to reset all state.
