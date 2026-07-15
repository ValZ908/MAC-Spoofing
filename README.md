# Local Network Security Center

Self-contained Windows tool for **ARP MAC-spoofing detection**, **router MAC blocking**, and **local adapter MAC rotation**. Everything runs on your machine — **no cloud account, no `.env` file**.

## Requirements

- Windows 10/11
- Node.js 20+
- Python 3.10+
- Npcap (required by Scapy for packet capture)
- Administrator privileges for MAC changes and ARP sniffing
- Optional: SSH-capable router for auto-block / Disconnect

## Quick start

```bash
# 1. Install JS deps
npm install

# 2. Install Python deps
pip install -r requirements.txt

# 3. Start the dashboard (creates data/app.db automatically)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

In a **separate Administrator** terminal:

```bash
python detector.py
```

The dashboard shows the detector as Online once heartbeats arrive (~10s).

## Features that actually do something

| Feature | What it does |
|---|---|
| Detector | Sniffs ARP replies, upserts devices, raises alerts |
| Auto-block | SSH into your router using Settings → Block Command |
| Disconnect | Same SSH block for a chosen device MAC |
| Trust | Skips auto-block when the attacker MAC is trusted |
| Identity Rotate | Changes Windows adapter NetworkAddress via PowerShell |
| Identity Lock | Watchdog reverts unauthorized MAC changes |

## Settings

Fill in **Settings** with your router's IP, SSH credentials, and a block command. Use `{mac}` as the placeholder, e.g.:

```text
iptables -A FORWARD -m mac --mac-source {mac} -j DROP
```

Sensitivity (seconds) is the window in which a sudden IP→MAC change counts as spoofing.

## Lab test

With the dashboard and detector running:

```bash
# Edit TARGET_IP in test_spoof.py first
python test_spoof.py
```

## Data

All state is stored in `data/app.db` (SQLite, auto-created, gitignored).

Optional detector API override:

```bash
python detector.py --api http://127.0.0.1:3000
```

## Notes

- Run `npm run dev` **as Administrator** if you want Identity Lock / Rotate to succeed on the live internet adapter.
- This is a local admin tool; there is no login screen. Do not expose port 3000 to untrusted networks.
