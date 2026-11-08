-- Allow delegated Admin/Moderator promotion only when both required permissions are granted.
-- Enrollment updates remain protected by the existing Students permission RLS policy.
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
      and p.is_active = true
      and (
        p.role = 'super_admin'
        or (
          p.role in ('admin','moderator')
          and coalesce((p.permissions->>'promotion')::boolean,false)
          and coalesce((p.permissions->>'students')::boolean,false)
        )
      )
  ) then
    raise exception 'Active Super Admin, or an Admin/Moderator with both Promotion and Students permissions, is required.';
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
