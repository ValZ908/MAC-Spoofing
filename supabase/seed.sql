-- Sample data for exercising the dashboard UI before the Python detector is wired up.
insert into devices (mac_address, ip_address, hostname, vendor, is_trusted, status, first_seen, last_seen)
values
  ('AA:BB:CC:00:11:22', '192.168.1.10', 'admin-laptop', 'Dell Inc.', true, 'active', now() - interval '2 days', now()),
  ('AA:BB:CC:00:11:23', '192.168.1.11', 'kitchen-tv', 'Samsung', true, 'active', now() - interval '5 days', now()),
  ('AA:BB:CC:00:11:24', '192.168.1.12', 'iphone-guest', 'Apple, Inc.', false, 'active', now() - interval '1 hour', now()),
  ('DE:AD:BE:EF:00:01', '192.168.1.15', null, null, false, 'disconnected', now() - interval '30 minutes', now() - interval '10 minutes')
on conflict (mac_address) do nothing;

insert into alerts (created_at, target_ip, real_mac, attacker_mac, status, device_id)
select
  now() - interval '10 minutes',
  '192.168.1.10',
  'AA:BB:CC:00:11:22',
  'DE:AD:BE:EF:00:01',
  'unhandled',
  d.id
from devices d where d.mac_address = 'AA:BB:CC:00:11:22';

insert into alerts (created_at, target_ip, real_mac, attacker_mac, status)
values
  (now() - interval '2 hours', '192.168.1.11', 'AA:BB:CC:00:11:23', 'DE:AD:BE:EF:00:02', 'blocked'),
  (now() - interval '1 day', '192.168.1.1', '11:22:33:44:55:66', 'DE:AD:BE:EF:00:03', 'ignored');
