-- Allow the new delegated administrator roles in user_profiles.
alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role = any (array['super_admin','admin','moderator','teacher','student']::text[]));
