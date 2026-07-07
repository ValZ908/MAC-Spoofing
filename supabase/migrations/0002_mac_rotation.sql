-- Configuration for local MAC address rotation (identity obfuscation)
create table if not exists mac_rotation_config (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  policy text not null default 'manual' check (policy in ('manual', 'interval', 'network_change')),
  interval_minutes integer not null default 30
);

insert into mac_rotation_config (enabled, policy, interval_minutes)
select false, 'manual', 30
where not exists (select 1 from mac_rotation_config);

-- History of MAC rotations actually performed on the host machine
create table if not exists mac_rotation_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  adapter_name text not null,
  previous_mac text not null,
  new_mac text not null,
  triggered_by text not null default 'manual' check (triggered_by in ('manual', 'interval', 'network_change'))
);

alter table mac_rotation_config enable row level security;
alter table mac_rotation_log enable row level security;

create policy "Authenticated users can read rotation config" on mac_rotation_config
  for select to authenticated using (true);
create policy "Authenticated users can update rotation config" on mac_rotation_config
  for update to authenticated using (true);

create policy "Authenticated users can read rotation log" on mac_rotation_log
  for select to authenticated using (true);
create policy "Authenticated users can insert rotation log" on mac_rotation_log
  for insert to authenticated with check (true);

alter publication supabase_realtime add table mac_rotation_log;
