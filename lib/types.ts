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

export type Alert = {
  id: string;
  created_at: string;
  target_ip: string;
  real_mac: string;
  attacker_mac: string;
  status: AlertStatus;
  device_id: string | null;
};

export type RouterConfig = {
  id: string;
  router_ip: string;
  username: string;
  password: string;
  block_command_template: string;
  spoof_window_seconds: number;
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
