-- Adapters whose MAC address should be locked to their real hardware value.
-- A background watchdog (see instrumentation.ts) periodically checks these
-- and reverts + logs an alert if the adapter's MAC drifts from locked_mac.
create table if not exists adapter_locks (
  id uuid primary key default gen_random_uuid(),
  adapter_name text not null unique,
  locked_mac text not null,
  is_locked boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table adapter_locks enable row level security;

create policy "Authenticated users can read adapter locks" on adapter_locks
  for select to authenticated using (true);
create policy "Authenticated users can update adapter locks" on adapter_locks
  for update to authenticated using (true);
create policy "Authenticated users can insert adapter locks" on adapter_locks
  for insert to authenticated with check (true);

-- Allow the watchdog to log an enforcement event alongside real rotations.
alter table mac_rotation_log drop constraint if exists mac_rotation_log_triggered_by_check;
alter table mac_rotation_log add constraint mac_rotation_log_triggered_by_check
  check (triggered_by in ('manual', 'interval', 'network_change', 'lock_enforcement'));

alter publication supabase_realtime add table adapter_locks;
