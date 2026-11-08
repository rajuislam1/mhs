-- Academic-year lifecycle, enrollment backfill, and safe student promotion.
-- Existing student, enrollment, promotion, and result records are preserved.

create unique index if not exists academic_years_year_unique_idx
  on public.academic_years (year);

create unique index if not exists academic_years_single_active_idx
  on public.academic_years ((is_active))
  where is_active = true;

insert into public.student_enrollments
  (student_id, academic_year_id, class_id, roll, enrollment_status, enrolled_at)
select s.id, s.academic_year_id, s.class_id, s.roll, 'active',
       coalesce(s.created_at, now())
from public.students s
where s.academic_year_id is not null
  and s.class_id is not null
on conflict (student_id, academic_year_id) do nothing;

drop policy if exists "Students can view own academic enrollments" on public.student_enrollments;
create policy "Students can view own academic enrollments"
on public.student_enrollments
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role = 'student'
      and p.is_active = true
      and p.student_id = student_enrollments.student_id
  )
);

create or replace function public.mhs_set_active_academic_year(p_year_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
      and p.is_active = true
  ) then
    raise exception 'Only an active Super Admin can change the active academic year.';
  end if;

  if not exists (select 1 from public.academic_years where id = p_year_id) then
    raise exception 'Academic year not found.';
  end if;

  update public.academic_years set is_active = false where is_active = true;
  update public.academic_years set is_active = true where id = p_year_id;
end;
$$;

create or replace function public.mhs_promote_students(
  p_student_ids uuid[],
  p_source_year_id uuid,
  p_target_year_id uuid,
  p_target_class_id uuid,
  p_remarks text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_student_id uuid;
  v_student public.students%rowtype;
  v_source_year bigint;
  v_target_year bigint;
  v_count integer := 0;
begin
  if not exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
      and p.is_active = true
  ) then
    raise exception 'Only an active Super Admin can promote students.';
  end if;

  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception 'Select at least one student.';
  end if;

  select year into v_source_year from public.academic_years where id = p_source_year_id;
  select year into v_target_year from public.academic_years where id = p_target_year_id and is_active = true;

  if v_source_year is null or v_target_year is null then
    raise exception 'Select a valid source year and the active destination year.';
  end if;
  if v_target_year <= v_source_year then
    raise exception 'Destination academic year must be later than the source year.';
  end if;
  if not exists (select 1 from public.classes where id = p_target_class_id and status = true) then
    raise exception 'Destination class is not active.';
  end if;

  foreach v_student_id in array p_student_ids loop
    select * into v_student
    from public.students
    where id = v_student_id
      and academic_year_id = p_source_year_id
      and status = true
    for update;

    if not found then
      raise exception 'A selected student does not belong to the selected source year or is inactive.';
    end if;

    if exists (
      select 1 from public.student_enrollments
      where student_id = v_student_id and academic_year_id = p_target_year_id
    ) then
      raise exception 'Student % already has an enrollment in the destination year.', v_student.student_id;
    end if;

    insert into public.student_enrollments
      (student_id, academic_year_id, class_id, roll, enrollment_status, enrolled_at, remarks)
    values
      (v_student_id, p_source_year_id, v_student.class_id, v_student.roll, 'active',
       coalesce(v_student.created_at, now()), 'Migrated from existing student record')
    on conflict (student_id, academic_year_id) do nothing;

    update public.student_enrollments
       set enrollment_status = 'completed',
           completed_at = now()
     where student_id = v_student_id
       and academic_year_id = p_source_year_id;

    insert into public.student_promotions
      (student_id, academic_year_id, from_class_id, to_class_id,
       promotion_status, promoted_at, remarks)
    values
      (v_student_id, p_target_year_id, v_student.class_id, p_target_class_id,
       'promoted', now(), nullif(trim(coalesce(p_remarks, '')), ''));

    insert into public.student_enrollments
      (student_id, academic_year_id, class_id, roll, enrollment_status, enrolled_at, remarks)
    values
      (v_student_id, p_target_year_id, p_target_class_id, v_student.roll,
       'active', now(), nullif(trim(coalesce(p_remarks, '')), ''));

    update public.students
       set class_id = p_target_class_id,
           academic_year_id = p_target_year_id,
           updated_at = now()
     where id = v_student_id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.mhs_set_active_academic_year(uuid) from public;
revoke all on function public.mhs_promote_students(uuid[], uuid, uuid, uuid, text) from public;
grant execute on function public.mhs_set_active_academic_year(uuid) to authenticated;
grant execute on function public.mhs_promote_students(uuid[], uuid, uuid, uuid, text) to authenticated;
