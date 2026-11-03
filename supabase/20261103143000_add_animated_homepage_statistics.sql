-- Add admin-managed animated homepage statistics without changing existing school data.
alter table public.school_public_statistics
  add column if not exists animated_stats jsonb not null default '[]'::jsonb;
comment on column public.school_public_statistics.animated_stats is
  'Admin-managed list of animated homepage counters: label, value, icon, note, display_order, is_active.';
