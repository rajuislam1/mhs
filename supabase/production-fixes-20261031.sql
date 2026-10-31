-- MHS production fixes — 2026-10-31
-- These statements were applied to the production Supabase project and are
-- committed here for reproducible schema/policy history.

-- Result publication: published_by references teachers(id), not auth.users.
-- Keep it NULL for both admins and teachers; store the auth user in
-- published_by_user_id (FK to auth.users).
drop policy if exists "Teachers can publish assigned draft results" on public.results;
create policy "Teachers can publish assigned draft results"
on public.results for update to authenticated
using (
  status = 'draft'
  and exists (
    select 1 from public.user_profiles p
    join public.teacher_assignments a on a.teacher_id=p.teacher_id
    join public.class_subjects cs on cs.class_id=a.class_id
      and cs.subject_id=a.subject_id and cs.academic_year_id=a.academic_year_id
    where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true
      and a.status=true and cs.id=results.class_subject_id
      and a.academic_year_id=results.academic_year_id
  )
)
with check (
  status = 'published'
  and published_by is null
  and published_by_user_id = (select auth.uid())
  and published_at is not null
  and exists (
    select 1 from public.user_profiles p
    join public.teacher_assignments a on a.teacher_id=p.teacher_id
    join public.class_subjects cs on cs.class_id=a.class_id
      and cs.subject_id=a.subject_id and cs.academic_year_id=a.academic_year_id
    join public.students st on st.id=results.student_id
      and st.class_id=cs.class_id and st.academic_year_id=cs.academic_year_id
    where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true
      and a.status=true and cs.id=results.class_subject_id
      and a.academic_year_id=results.academic_year_id
  )
);

-- Teacher routine insert is limited to the teacher's active assigned class,
-- subject and academic year; inactive teacher records cannot insert.
drop policy if exists "Teachers can insert routines for assigned classes" on public.class_routines;
create policy "Teachers can insert routines for assigned classes"
on public.class_routines for insert to authenticated
with check (
  teacher_id = (
    select p.teacher_id from public.user_profiles p
    where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true
  )
  and exists (
    select 1 from public.teacher_assignments a
    join public.teachers t on t.id=a.teacher_id
    where a.teacher_id=class_routines.teacher_id
      and a.class_id=class_routines.class_id
      and a.subject_id=class_routines.subject_id
      and a.academic_year_id=class_routines.academic_year_id
      and a.status=true and t.status=true
  )
);

-- Online admission is a public INSERT-only workflow. Public visitors can
-- submit pending applications, but cannot set review fields or edit records.
drop policy if exists "Public can submit pending admission applications" on public.admission_applications;
create policy "Public can submit pending admission applications"
on public.admission_applications for insert to anon, authenticated
with check (
  application_status='pending'
  and reviewed_at is null
  and reviewed_by is null
  and remarks is null
);
grant insert on public.admission_applications to anon, authenticated;

-- Publish only aggregate counters publicly; do not expose student/teacher rows.
drop view if exists public.public_school_statistics;
create table if not exists public.school_public_statistics (
  id smallint primary key default 1 check (id=1),
  active_students integer not null default 0,
  active_teachers integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.school_public_statistics enable row level security;
drop policy if exists "Public can read school statistics" on public.school_public_statistics;
create policy "Public can read school statistics" on public.school_public_statistics
for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger
on public.school_public_statistics from anon, authenticated;
grant select on public.school_public_statistics to anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.refresh_school_public_statistics()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.school_public_statistics(id,active_students,active_teachers,updated_at)
  values (
    1,
    (select count(*)::integer from public.students where status=true),
    (select count(*)::integer from public.teachers where status=true),
    now()
  )
  on conflict(id) do update set
    active_students=excluded.active_students,
    active_teachers=excluded.active_teachers,
    updated_at=excluded.updated_at;
  return null;
end;
$$;
revoke all on function private.refresh_school_public_statistics() from public, anon, authenticated;
drop trigger if exists refresh_school_statistics_from_students on public.students;
create trigger refresh_school_statistics_from_students
after insert or update of status or delete on public.students
for each statement execute function private.refresh_school_public_statistics();
drop trigger if exists refresh_school_statistics_from_teachers on public.teachers;
create trigger refresh_school_statistics_from_teachers
after insert or update of status or delete on public.teachers
for each statement execute function private.refresh_school_public_statistics();
insert into public.school_public_statistics(id,active_students,active_teachers,updated_at)
values (
  1,
  (select count(*)::integer from public.students where status=true),
  (select count(*)::integer from public.teachers where status=true),
  now()
)
on conflict(id) do update set
  active_students=excluded.active_students,
  active_teachers=excluded.active_teachers,
  updated_at=excluded.updated_at;
