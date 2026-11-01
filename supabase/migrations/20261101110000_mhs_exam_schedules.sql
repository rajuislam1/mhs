create table if not exists public.exam_schedules (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  exam_name text not null check (exam_name in ('Half Yearly','Final')),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  exam_date date not null,
  start_time time,
  end_time time,
  room text,
  instructions text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_schedules_time_check check (start_time is null or end_time is null or end_time > start_time),
  constraint exam_schedules_unique_subject_date unique (academic_year_id,class_id,exam_name,subject_id)
);
create index if not exists exam_schedules_class_year_exam_idx
  on public.exam_schedules(academic_year_id,class_id,exam_name,exam_date);
alter table public.exam_schedules enable row level security;
grant select, insert, update, delete on public.exam_schedules to authenticated;
drop policy if exists "Active admins manage exam schedules" on public.exam_schedules;
create policy "Active admins manage exam schedules"
on public.exam_schedules for all to authenticated
using (exists (
  select 1 from public.user_profiles p
  where p.id = (select auth.uid()) and p.role = 'super_admin' and p.is_active = true
))
with check (exists (
  select 1 from public.user_profiles p
  where p.id = (select auth.uid()) and p.role = 'super_admin' and p.is_active = true
));
drop policy if exists "Students read own class exam schedules" on public.exam_schedules;
create policy "Students read own class exam schedules"
on public.exam_schedules for select to authenticated
using (exists (
  select 1
  from public.user_profiles p
  join public.students s on s.id = p.student_id
  where p.id = (select auth.uid())
    and p.role = 'student'
    and p.is_active = true
    and s.status = true
    and s.class_id = exam_schedules.class_id
    and s.academic_year_id = exam_schedules.academic_year_id
));
drop policy if exists "Assigned teachers read exam schedules" on public.exam_schedules;
create policy "Assigned teachers read exam schedules"
on public.exam_schedules for select to authenticated
using (exists (
  select 1
  from public.user_profiles p
  join public.teacher_assignments a on a.teacher_id = p.teacher_id
  where p.id = (select auth.uid())
    and p.role = 'teacher'
    and p.is_active = true
    and a.status = true
    and a.class_id = exam_schedules.class_id
    and a.subject_id = exam_schedules.subject_id
    and a.academic_year_id = exam_schedules.academic_year_id
));
