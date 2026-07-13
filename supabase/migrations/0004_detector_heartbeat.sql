-- Liveness signal from the Python detector script (detector.py).
-- Without this, the dashboard can only react to events it receives, so a
-- crashed/stopped sniffer looks identical to "no attacks happening" — it
-- would show "Secure" even though nothing is being monitored.
-- The detector upserts one row per hostname every ~10 seconds; the
-- dashboard treats any row not updated recently as offline.
create table if not exists detector_heartbeat (
  id uuid primary key default gen_random_uuid(),
  hostname text not null unique,
  last_seen timestamptz not null default now()
);

alter table detector_heartbeat enable row level security;

-- Only reads are needed from the dashboard side. The detector script writes
-- using the service role key, which bypasses RLS, so no insert/update
-- policy is needed here.
create policy "Authenticated users can read detector heartbeat" on detector_heartbeat
  for select to authenticated using (true);

alter publication supabase_realtime add table detector_heartbeat;