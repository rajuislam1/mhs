-- Exam routine publication gate for student admit-card downloads.
create table if not exists public.exam_routine_publications (
 id uuid primary key default gen_random_uuid(),
 academic_year_id uuid not null references public.academic_years(id) on delete cascade,
 class_id uuid not null references public.classes(id) on delete cascade,
 exam_name text not null check (exam_name in ('Half Yearly','Final')),
 is_published boolean not null default false,
 published_at timestamptz,
 published_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 constraint exam_routine_publications_unique unique (academic_year_id,class_id,exam_name)
);
create index if not exists exam_routine_publications_lookup_idx on public.exam_routine_publications(academic_year_id,class_id,exam_name,is_published);
alter table public.exam_routine_publications enable row level security;
grant select,insert,update on public.exam_routine_publications to authenticated;
drop policy if exists "Active admins manage exam routine publication" on public.exam_routine_publications;
create policy "Active admins manage exam routine publication" on public.exam_routine_publications for all to authenticated
using (exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='super_admin' and p.is_active=true))
with check (exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='super_admin' and p.is_active=true));
drop policy if exists "Students read published own exam routine status" on public.exam_routine_publications;
create policy "Students read published own exam routine status" on public.exam_routine_publications for select to authenticated
using (is_published=true and exists(select 1 from public.user_profiles p join public.students s on s.id=p.student_id where p.id=(select auth.uid()) and p.role='student' and p.is_active=true and s.status=true and s.class_id=exam_routine_publications.class_id and s.academic_year_id=exam_routine_publications.academic_year_id));
drop policy if exists "Students read own class exam schedules" on public.exam_schedules;
create policy "Students read own class exam schedules" on public.exam_schedules for select to authenticated
using (exists(select 1 from public.user_profiles p join public.students s on s.id=p.student_id join public.exam_routine_publications pub on pub.class_id=exam_schedules.class_id and pub.academic_year_id=exam_schedules.academic_year_id and pub.exam_name=exam_schedules.exam_name and pub.is_published=true where p.id=(select auth.uid()) and p.role='student' and p.is_active=true and s.status=true and s.class_id=exam_schedules.class_id and s.academic_year_id=exam_schedules.academic_year_id));
