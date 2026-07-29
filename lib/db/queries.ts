import { getDb, nowIso, boolToInt, intToBool } from "./index";
import type {
  AdapterLock,
  Alert,
  AlertStatus,
  BlockMethod,
  DetectionSettings,
  DetectorHeartbeat,
  Device,
  GatewayLock,
  MacRotationLogEntry,
  RouterConfig,
  TriggerReason,
} from "@/lib/types";

type DeviceRow = {
  id: string;
  mac_address: string;
  ip_address: string | null;
  hostname: string | null;
  vendor: string | null;
  is_trusted: number;
  status: "active" | "disconnected";
  first_seen: string;
  last_seen: string;
};

type AlertRow = {
  id: string;
  created_at: string;
  attack_type: string;
  target_ip: string;
  real_mac: string;
  attacker_mac: string;
  status: AlertStatus;
  block_method: BlockMethod | null;
  device_id: string | null;
};

type RouterConfigRow = {
  id: string;
  router_ip: string;
  username: string;
  password: string;
  block_command_template: string;
  spoof_window_seconds: number;
  alert_cooldown_seconds: number;
  min_poisoning_ips: number;
};

type LockRow = {
  id: string;
  adapter_name: string;
  locked_mac: string;
  is_locked: number;
  updated_at: string;
};

type GatewayLockRow = {
  id: string;
  gateway_ip: string;
  interface_alias: string;
  locked_mac: string;
  is_locked: number;
  updated_at: string;
};

type RotationRow = {
  id: string;
  created_at: string;
  adapter_name: string;
  previous_mac: string;
  new_mac: string;
  triggered_by: TriggerReason;
};

type HeartbeatRow = {
  id: string;
  hostname: string;
  last_seen: string;
};

function mapDevice(row: DeviceRow): Device {
  return {
    ...row,
    is_trusted: intToBool(row.is_trusted),
  };
}

function mapAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    created_at: row.created_at,
    attack_type: row.attack_type as Alert["attack_type"],
    target_ip: row.target_ip,
    real_mac: row.real_mac,
    attacker_mac: row.attacker_mac,
    status: row.status,
    block_method: row.block_method,
    device_id: row.device_id,
  };
}

function mapLock(row: LockRow): AdapterLock {
  return {
    ...row,
    is_locked: intToBool(row.is_locked),
  };
}

function mapGatewayLock(row: GatewayLockRow): GatewayLock {
  return {
    ...row,
    is_locked: intToBool(row.is_locked),
  };
}

// --- Devices ---

export function listDevices(): Device[] {
  const rows = getDb()
    .prepare("SELECT * FROM devices ORDER BY last_seen DESC")
    .all() as DeviceRow[];
  return rows.map(mapDevice);
}

export function countDevices(filter?: {
  status?: Device["status"];
  isTrusted?: boolean;
}): number {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter?.isTrusted !== undefined) {
    clauses.push("is_trusted = ?");
    params.push(boolToInt(filter.isTrusted));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM devices ${where}`)
    .get(...params) as { c: number };
  return row.c;
}

export function getDeviceById(id: string): Device | null {
  const row = getDb()
    .prepare("SELECT * FROM devices WHERE id = ?")
    .get(id) as DeviceRow | undefined;
  return row ? mapDevice(row) : null;
}

export function getDeviceByMac(mac: string): Device | null {
  const row = getDb()
    .prepare("SELECT * FROM devices WHERE mac_address = ? COLLATE NOCASE")
    .get(mac) as DeviceRow | undefined;
  return row ? mapDevice(row) : null;
}

export function upsertDevice(input: {
  mac_address: string;
  ip_address: string | null;
  vendor: string | null;
}): Device {
  const db = getDb();
  const existing = getDeviceByMac(input.mac_address);
  const ts = nowIso();

  if (existing) {
    db.prepare(
      `UPDATE devices
       SET ip_address = ?, vendor = COALESCE(?, vendor), status = 'active', last_seen = ?
       WHERE id = ?`
    ).run(input.ip_address, input.vendor, ts, existing.id);
    return getDeviceById(existing.id)!;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO devices
      (id, mac_address, ip_address, hostname, vendor, is_trusted, status, first_seen, last_seen)
     VALUES (?, ?, ?, NULL, ?, 0, 'active', ?, ?)`
  ).run(id, input.mac_address, input.ip_address, input.vendor, ts, ts);
  return getDeviceById(id)!;
}

export function setDeviceTrusted(id: string, trusted: boolean): void {
  getDb()
    .prepare("UPDATE devices SET is_trusted = ? WHERE id = ?")
    .run(boolToInt(trusted), id);
}

export function setDeviceStatus(
  id: string,
  status: Device["status"]
): void {
  getDb()
    .prepare("UPDATE devices SET status = ? WHERE id = ?")
    .run(status, id);
}

export function markStaleDevicesDisconnected(staleSeconds: number): number {
  const cutoff = new Date(Date.now() - staleSeconds * 1000).toISOString();
  const result = getDb()
    .prepare(
      `UPDATE devices
       SET status = 'disconnected'
       WHERE status = 'active' AND last_seen < ?`
    )
    .run(cutoff);
  return result.changes;
}

// --- Alerts ---

export function listAlerts(limit?: number): Alert[] {
  const sql =
    limit !== undefined
      ? "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?"
      : "SELECT * FROM alerts ORDER BY created_at DESC";
  const rows = (
    limit !== undefined
      ? getDb().prepare(sql).all(limit)
      : getDb().prepare(sql).all()
  ) as AlertRow[];
  return rows.map(mapAlert);
}

export function countAlerts(status?: AlertStatus): number {
  if (status) {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS c FROM alerts WHERE status = ?")
      .get(status) as { c: number };
    return row.c;
  }
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM alerts")
    .get() as { c: number };
  return row.c;
}

export function insertAlert(input: {
  attack_type: string;
  target_ip: string;
  real_mac: string;
  attacker_mac: string;
}): Alert {
  const id = crypto.randomUUID();
  const created_at = nowIso();
  getDb()
    .prepare(
      `INSERT INTO alerts
        (id, created_at, attack_type, target_ip, real_mac, attacker_mac, status, device_id)
       VALUES (?, ?, ?, ?, ?, ?, 'unhandled', NULL)`
    )
    .run(
      id,
      created_at,
      input.attack_type,
      input.target_ip,
      input.real_mac,
      input.attacker_mac
    );
  return {
    id,
    created_at,
    attack_type: input.attack_type as Alert["attack_type"],
    target_ip: input.target_ip,
    real_mac: input.real_mac,
    attacker_mac: input.attacker_mac,
    status: "unhandled",
    block_method: null,
    device_id: null,
  };
}

export function getAlertById(id: string): Alert | null {
  const row = getDb()
    .prepare("SELECT * FROM alerts WHERE id = ?")
    .get(id) as AlertRow | undefined;
  return row ? mapAlert(row) : null;
}

export function updateAlertStatus(id: string, status: AlertStatus): void {
  getDb()
    .prepare("UPDATE alerts SET status = ? WHERE id = ?")
    .run(status, id);
}

export function markAlertBlocked(id: string, method: BlockMethod): void {
  getDb()
    .prepare("UPDATE alerts SET status = 'blocked', block_method = ? WHERE id = ?")
    .run(method, id);
}

export function findRecentDuplicateAlert(
  attackType: string,
  attackerMac: string,
  targetIp: string,
  cooldownSeconds: number
): boolean {
  const cutoff = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
  const normalized = attackerMac.replaceAll("-", ":").toUpperCase();
  const row = getDb()
    .prepare(
      `SELECT id FROM alerts
       WHERE attack_type = ?
         AND UPPER(REPLACE(attacker_mac, '-', ':')) = ?
         AND target_ip = ?
         AND created_at >= ?
       LIMIT 1`
    )
    .get(attackType, normalized, targetIp, cutoff) as { id: string } | undefined;
  return Boolean(row);
}

// --- Router config ---

export function getRouterConfig(): RouterConfig {
  const row = getDb()
    .prepare("SELECT * FROM router_config LIMIT 1")
    .get() as RouterConfigRow;
  return {
    ...row,
    alert_cooldown_seconds: row.alert_cooldown_seconds ?? 300,
    min_poisoning_ips: row.min_poisoning_ips ?? 3,
  };
}

export function listGatewayIps(): string[] {
  const ips = new Set<string>();
  const config = getRouterConfig();
  if (config.router_ip) ips.add(config.router_ip);

  const locks = getDb()
    .prepare(
      "SELECT gateway_ip FROM gateway_locks WHERE is_locked = 1"
    )
    .all() as { gateway_ip: string }[];
  for (const lock of locks) ips.add(lock.gateway_ip);
  return [...ips];
}

export function listGatewayMacs(): string[] {
  const macs = new Set<string>();
  const locks = getDb()
    .prepare(
      "SELECT locked_mac FROM gateway_locks WHERE is_locked = 1"
    )
    .all() as { locked_mac: string }[];
  for (const lock of locks) {
    macs.add(lock.locked_mac.replaceAll("-", ":").toUpperCase());
  }
  return [...macs];
}

export function isGatewayIp(ip: string): boolean {
  return listGatewayIps().includes(ip);
}

export function isGatewayMac(mac: string): boolean {
  const normalized = mac.replaceAll("-", ":").toUpperCase();
  return listGatewayMacs().includes(normalized);
}

export function getDetectionSettings(): DetectionSettings {
  const config = getRouterConfig();
  return {
    spoof_window_seconds: config.spoof_window_seconds,
    alert_cooldown_seconds: config.alert_cooldown_seconds,
    min_poisoning_ips: config.min_poisoning_ips,
    gateway_ips: listGatewayIps(),
    gateway_macs: listGatewayMacs(),
  };
}

export function updateRouterConfig(input: {
  router_ip: string;
  username: string;
  password: string;
  block_command_template: string;
  spoof_window_seconds: number;
  alert_cooldown_seconds: number;
  min_poisoning_ips: number;
}): void {
  const existing = getRouterConfig();
  getDb()
    .prepare(
      `UPDATE router_config
       SET router_ip = ?, username = ?, password = ?,
           block_command_template = ?, spoof_window_seconds = ?,
           alert_cooldown_seconds = ?, min_poisoning_ips = ?
       WHERE id = ?`
    )
    .run(
      input.router_ip,
      input.username,
      input.password,
      input.block_command_template,
      input.spoof_window_seconds,
      input.alert_cooldown_seconds,
      input.min_poisoning_ips,
      existing.id
    );
}

// --- Adapter locks ---

export function listAdapterLocks(): AdapterLock[] {
  const rows = getDb()
    .prepare("SELECT * FROM adapter_locks")
    .all() as LockRow[];
  return rows.map(mapLock);
}

export function getAdapterLock(adapterName: string): AdapterLock | null {
  const row = getDb()
    .prepare("SELECT * FROM adapter_locks WHERE adapter_name = ?")
    .get(adapterName) as LockRow | undefined;
  return row ? mapLock(row) : null;
}

export function upsertAdapterLock(input: {
  adapter_name: string;
  locked_mac: string;
  is_locked: boolean;
}): void {
  const db = getDb();
  const existing = getAdapterLock(input.adapter_name);
  const ts = nowIso();
  if (existing) {
    db.prepare(
      `UPDATE adapter_locks
       SET locked_mac = ?, is_locked = ?, updated_at = ?
       WHERE adapter_name = ?`
    ).run(
      input.locked_mac,
      boolToInt(input.is_locked),
      ts,
      input.adapter_name
    );
    return;
  }
  db.prepare(
    `INSERT INTO adapter_locks (id, adapter_name, locked_mac, is_locked, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    input.adapter_name,
    input.locked_mac,
    boolToInt(input.is_locked),
    ts
  );
}

export function setAdapterUnlocked(adapterName: string): void {
  getDb()
    .prepare(
      `UPDATE adapter_locks SET is_locked = 0, updated_at = ? WHERE adapter_name = ?`
    )
    .run(nowIso(), adapterName);
}

// --- Gateway locks (static ARP pin) ---

export function listGatewayLocks(): GatewayLock[] {
  const rows = getDb()
    .prepare("SELECT * FROM gateway_locks")
    .all() as GatewayLockRow[];
  return rows.map(mapGatewayLock);
}

export function getGatewayLock(gatewayIp: string): GatewayLock | null {
  const row = getDb()
    .prepare("SELECT * FROM gateway_locks WHERE gateway_ip = ?")
    .get(gatewayIp) as GatewayLockRow | undefined;
  return row ? mapGatewayLock(row) : null;
}

export function upsertGatewayLock(input: {
  gateway_ip: string;
  interface_alias: string;
  locked_mac: string;
  is_locked: boolean;
}): void {
  const db = getDb();
  const existing = getGatewayLock(input.gateway_ip);
  const ts = nowIso();
  if (existing) {
    db.prepare(
      `UPDATE gateway_locks
       SET interface_alias = ?, locked_mac = ?, is_locked = ?, updated_at = ?
       WHERE gateway_ip = ?`
    ).run(
      input.interface_alias,
      input.locked_mac,
      boolToInt(input.is_locked),
      ts,
      input.gateway_ip
    );
    return;
  }
  db.prepare(
    `INSERT INTO gateway_locks
      (id, gateway_ip, interface_alias, locked_mac, is_locked, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    input.gateway_ip,
    input.interface_alias,
    input.locked_mac,
    boolToInt(input.is_locked),
    ts
  );
}

export function setGatewayUnlocked(gatewayIp: string): void {
  getDb()
    .prepare(
      `UPDATE gateway_locks SET is_locked = 0, updated_at = ? WHERE gateway_ip = ?`
    )
    .run(nowIso(), gatewayIp);
}

// --- MAC rotation log ---

export function listMacRotationLog(limit = 20): MacRotationLogEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM mac_rotation_log ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as RotationRow[];
  return rows;
}

export function insertMacRotationLog(input: {
  adapter_name: string;
  previous_mac: string;
  new_mac: string;
  triggered_by: TriggerReason;
}): void {
  getDb()
    .prepare(
      `INSERT INTO mac_rotation_log
        (id, created_at, adapter_name, previous_mac, new_mac, triggered_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      crypto.randomUUID(),
      nowIso(),
      input.adapter_name,
      input.previous_mac,
      input.new_mac,
      input.triggered_by
    );
}

export function clearMacRotationLog(): void {
  getDb().prepare("DELETE FROM mac_rotation_log").run();
}

// --- Heartbeat ---

export function upsertDetectorHeartbeat(hostname: string): DetectorHeartbeat {
  const db = getDb();
  const ts = nowIso();
  const existing = db
    .prepare("SELECT * FROM detector_heartbeat WHERE hostname = ?")
    .get(hostname) as HeartbeatRow | undefined;

  if (existing) {
    db.prepare(
      "UPDATE detector_heartbeat SET last_seen = ? WHERE hostname = ?"
    ).run(ts, hostname);
    return { id: existing.id, hostname, last_seen: ts };
  }

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO detector_heartbeat (id, hostname, last_seen) VALUES (?, ?, ?)"
  ).run(id, hostname, ts);
  return { id, hostname, last_seen: ts };
}

export function getLatestHeartbeat(): DetectorHeartbeat | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM detector_heartbeat ORDER BY last_seen DESC LIMIT 1"
    )
    .get() as HeartbeatRow | undefined;
  return row ?? null;
}

// --- Dashboard snapshot ---

export function getDashboardSnapshot() {
  return {
    activeDeviceCount: countDevices({ status: "active" }),
    trustedDeviceCount: countDevices({ status: "active", isTrusted: true }),
    recentAlerts: listAlerts(5),
    unhandledCount: countAlerts("unhandled"),
    blockedCount: countAlerts("blocked"),
    totalAlertCount: countAlerts(),
    lastHeartbeat: getLatestHeartbeat(),
  };
}
