-- Devices seen on the network (populated by the Python detector script)
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  mac_address text not null unique,
  ip_address text,
  hostname text,
  vendor text,
  is_trusted boolean not null default false,
  status text not null default 'active' check (status in ('active', 'disconnected')),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- MAC spoofing / ARP poisoning alerts (populated by the Python detector script)
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  target_ip text not null,
  real_mac text not null,
  attacker_mac text not null,
  status text not null default 'unhandled' check (status in ('unhandled', 'blocked', 'ignored')),
  device_id uuid references devices(id) on delete set null
);

-- Single-row table holding router connection details + sensitivity setting
create table if not exists router_config (
  id uuid primary key default gen_random_uuid(),
  router_ip text not null default '',
  username text not null default '',
  password text not null default '',
  block_command_template text not null default 'iptables -A FORWARD -m mac --mac-source {mac} -j DROP',
  spoof_window_seconds integer not null default 5
);

insert into router_config (router_ip, username, password, block_command_template, spoof_window_seconds)
select '', '', '', 'iptables -A FORWARD -m mac --mac-source {mac} -j DROP', 5
where not exists (select 1 from router_config);

alter table devices enable row level security;
alter table alerts enable row level security;
alter table router_config enable row level security;

-- Only logged-in admins (this dashboard's users) can read/write.
-- The Python detector script should write using the service role key,
-- which bypasses RLS, so it does not need its own policy here.
create policy "Authenticated users can read devices" on devices
  for select to authenticated using (true);
create policy "Authenticated users can update devices" on devices
  for update to authenticated using (true);

create policy "Authenticated users can read alerts" on alerts
  for select to authenticated using (true);
create policy "Authenticated users can update alerts" on alerts
  for update to authenticated using (true);

create policy "Authenticated users can read router config" on router_config
  for select to authenticated using (true);
create policy "Authenticated users can update router config" on router_config
  for update to authenticated using (true);

-- Realtime for live dashboard updates
alter publication supabase_realtime add table devices;
alter publication supabase_realtime add table alerts;
