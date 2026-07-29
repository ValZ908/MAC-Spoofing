import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  mac_address TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  hostname TEXT,
  vendor TEXT,
  is_trusted INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected')),
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  attack_type TEXT NOT NULL DEFAULT 'ip_mac_mismatch',
  target_ip TEXT NOT NULL,
  real_mac TEXT NOT NULL,
  attacker_mac TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unhandled' CHECK (status IN ('unhandled', 'blocked', 'ignored')),
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS router_config (
  id TEXT PRIMARY KEY,
  router_ip TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  block_command_template TEXT NOT NULL DEFAULT 'iptables -A FORWARD -m mac --mac-source {mac} -j DROP',
  spoof_window_seconds INTEGER NOT NULL DEFAULT 2,
  alert_cooldown_seconds INTEGER NOT NULL DEFAULT 300,
  min_poisoning_ips INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS mac_rotation_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  adapter_name TEXT NOT NULL,
  previous_mac TEXT NOT NULL,
  new_mac TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'manual'
    CHECK (triggered_by IN ('manual', 'interval', 'network_change', 'lock_enforcement'))
);

CREATE TABLE IF NOT EXISTS adapter_locks (
  id TEXT PRIMARY KEY,
  adapter_name TEXT NOT NULL UNIQUE,
  locked_mac TEXT NOT NULL,
  is_locked INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS detector_heartbeat (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gateway_locks (
  id TEXT PRIMARY KEY,
  gateway_ip TEXT NOT NULL UNIQUE,
  interface_alias TEXT NOT NULL,
  locked_mac TEXT NOT NULL,
  is_locked INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
`;

type GlobalDb = { __macSpoofDb?: Database.Database };

function migrate(db: Database.Database) {
  db.exec(SCHEMA);

  const columns = db
    .prepare("PRAGMA table_info(router_config)")
    .all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));
  if (!names.has("alert_cooldown_seconds")) {
    db.exec(
      "ALTER TABLE router_config ADD COLUMN alert_cooldown_seconds INTEGER NOT NULL DEFAULT 300"
    );
  }
  if (!names.has("min_poisoning_ips")) {
    db.exec(
      "ALTER TABLE router_config ADD COLUMN min_poisoning_ips INTEGER NOT NULL DEFAULT 3"
    );
  }

  const configCount = db
    .prepare("SELECT COUNT(*) AS c FROM router_config")
    .get() as { c: number };
  if (configCount.c === 0) {
    db.prepare(
      `INSERT INTO router_config
        (id, router_ip, username, password, block_command_template,
         spoof_window_seconds, alert_cooldown_seconds, min_poisoning_ips)
       VALUES (?, '', '', '', 'iptables -A FORWARD -m mac --mac-source {mac} -j DROP', 2, 300, 3)`
    ).run(crypto.randomUUID());
  }
}

export function getDb(): Database.Database {
  const g = globalThis as typeof globalThis & GlobalDb;
  if (g.__macSpoofDb) return g.__macSpoofDb;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  g.__macSpoofDb = db;
  return db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

export function intToBool(value: number | boolean): boolean {
  return Boolean(value);
}
