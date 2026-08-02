export type DeviceStatus = "active" | "disconnected";

export type Device = {
  id: string;
  mac_address: string;
  ip_address: string | null;
  hostname: string | null;
  vendor: string | null;
  is_trusted: boolean;
  status: DeviceStatus;
  first_seen: string;
  last_seen: string;
};

export type AlertStatus = "unhandled" | "blocked" | "ignored";

export type AttackType = "ip_mac_mismatch" | "arp_poisoning";

export type BlockMethod = "router" | "local_firewall";

export type Alert = {
  id: string;
  created_at: string;
  attack_type: AttackType;
  target_ip: string;
  real_mac: string;
  attacker_mac: string;
  status: AlertStatus;
  block_method: BlockMethod | null;
  device_id: string | null;
};

export type DetectorHeartbeat = {
  id: string;
  hostname: string;
  last_seen: string;
};

export type RouterConfig = {
  id: string;
  router_ip: string;
  username: string;
  password: string;
  block_command_template: string;
  spoof_window_seconds: number;
  alert_cooldown_seconds: number;
  min_poisoning_ips: number;
  detector_auto_start: boolean;
  detector_iface: string;
};

export type DetectionSettings = Pick<
  RouterConfig,
  "spoof_window_seconds" | "alert_cooldown_seconds" | "min_poisoning_ips"
> & {
  gateway_ips: string[];
  gateway_macs: string[];
};

export type RotationPolicy = "manual" | "interval" | "network_change";

export type TriggerReason = RotationPolicy | "lock_enforcement";

export type MacRotationLogEntry = {
  id: string;
  created_at: string;
  adapter_name: string;
  previous_mac: string;
  new_mac: string;
  triggered_by: TriggerReason;
};

export type NetworkAdapter = {
  name: string;
  description: string;
  macAddress: string;
  status: string;
};

export type AdapterLock = {
  id: string;
  adapter_name: string;
  locked_mac: string;
  is_locked: boolean;
  updated_at: string;
};

export type GatewayLock = {
  id: string;
  gateway_ip: string;
  interface_alias: string;
  locked_mac: string;
  is_locked: boolean;
  updated_at: string;
};

export type GatewayInfo = {
  ip: string;
  interfaceAlias: string;
  macAddress: string | null;
};
