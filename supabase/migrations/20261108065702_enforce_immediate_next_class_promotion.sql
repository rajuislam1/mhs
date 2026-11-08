-- Enforce immediate-next-class promotion for passed students.
-- Failed students continue in their existing class with an Admin-assigned roll.
create or replace function public.mhs_process_student_promotion(
  p_assignments jsonb,
  p_source_year_id uuid,
  p_target_year_id uuid,
  p_source_class_id uuid,
  p_remarks text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_assignment jsonb;
  v_student_id uuid;
  v_target_class_id uuid;
  v_roll integer;
  v_status text;
  v_student public.students%rowtype;
  v_source_year bigint;
  v_target_year bigint;
  v_source_class_number bigint;
  v_target_class_number bigint;
  v_required_count integer;
  v_published_count integer;
  v_missing_grade_points integer;
  v_failed_count integer;
  v_processed integer := 0;
begin
  if not exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid()) and p.is_active = true
      and (p.role = 'super_admin' or (
        p.role in ('admin','moderator')
        and coalesce((p.permissions->>'promotion')::boolean,false)
        and coalesce((p.permissions->>'students')::boolean,false)
      ))
  ) then raise exception 'Active Super Admin, or an Admin/Moderator with both Promotion and Students permissions, is required.'; end if;
  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' or jsonb_array_length(p_assignments)=0 then raise exception 'Select at least one student.'; end if;
  select year into v_source_year from public.academic_years where id=p_source_year_id;
  select year into v_target_year from public.academic_years where id=p_target_year_id and is_active=true;
  if v_source_year is null or v_target_year is null or v_target_year<=v_source_year then raise exception 'Select a valid earlier source year and the active destination year.'; end if;
  select class_number into v_source_class_number from public.classes where id=p_source_class_id and status=true;
  if v_source_class_number is null then raise exception 'Source class is not active.'; end if;
  if (select count(*) from jsonb_array_elements(p_assignments)) <> (select count(distinct value->>'student_id') from jsonb_array_elements(p_assignments)) then raise exception 'The assignment list contains a duplicate student.'; end if;

  for v_assignment in select value from jsonb_array_elements(p_assignments) loop
    v_student_id:=nullif(v_assignment->>'student_id','')::uuid;
    v_target_class_id:=nullif(v_assignment->>'target_class_id','')::uuid;
    v_roll:=nullif(v_assignment->>'roll','')::integer;
    v_status:=lower(coalesce(v_assignment->>'promotion_status',''));
    if v_student_id is null or v_target_class_id is null then raise exception 'Each assignment must include a student and destination class.'; end if;
    if v_roll is null or v_roll<1 then raise exception 'Every selected student must have a positive new roll number.'; end if;
    if v_status not in ('promoted','repeated') then raise exception 'Invalid promotion status.'; end if;

    select s.* into v_student from public.students s join public.student_enrollments e on e.student_id=s.id
    where s.id=v_student_id and s.status=true and e.academic_year_id=p_source_year_id
      and e.class_id=p_source_class_id and e.enrollment_status='active' for update of e;
    if not found then raise exception 'A selected student is not actively enrolled in the selected source year and class.'; end if;
    if exists(select 1 from public.student_enrollments where student_id=v_student_id and academic_year_id=p_target_year_id) then raise exception 'Student % already has an enrollment in the destination year.',v_student.student_id; end if;

    select count(*) into v_required_count from public.class_subjects cs
    where cs.academic_year_id=p_source_year_id and cs.class_id=p_source_class_id
      and (cs.is_compulsory=true or exists(select 1 from public.student_subjects ss where ss.student_id=v_student_id and ss.class_subject_id=cs.id));
    select count(r.id),
      count(*) filter(where r.id is not null and r.grade_point is null),
      count(*) filter(where r.id is not null and (coalesce(r.grade_point,0)<=0 or upper(coalesce(r.grade,''))='F'))
    into v_published_count,v_missing_grade_points,v_failed_count
    from public.class_subjects cs left join public.results r
      on r.class_subject_id=cs.id and r.student_id=v_student_id and r.academic_year_id=p_source_year_id
      and r.exam_name='Final' and r.status='published'
    where cs.academic_year_id=p_source_year_id and cs.class_id=p_source_class_id
      and (cs.is_compulsory=true or exists(select 1 from public.student_subjects ss where ss.student_id=v_student_id and ss.class_subject_id=cs.id));
    if v_required_count=0 or v_published_count<>v_required_count or v_missing_grade_points>0 then raise exception 'Final Result is incomplete for student %. Publish every required subject result first.',v_student.student_id; end if;

    select class_number into v_target_class_number from public.classes where id=v_target_class_id and status=true;
    if v_target_class_number is null then raise exception 'Destination class is not active.'; end if;
    if v_failed_count>0 then
      if v_status<>'repeated' or v_target_class_id<>p_source_class_id then raise exception 'Failed student % must repeat the same class with an Admin-assigned roll.',v_student.student_id; end if;
    else
      if v_status<>'promoted' or v_target_class_number<>v_source_class_number+1 then raise exception 'Passed student % must be promoted to the immediate next class.',v_student.student_id; end if;
    end if;

    if exists(select 1 from jsonb_array_elements(p_assignments) a where a.value->>'target_class_id'=v_target_class_id::text and (a.value->>'roll')::integer=v_roll and a.value->>'student_id'<>v_student_id::text) then raise exception 'Duplicate roll % in the same destination class.',v_roll; end if;
    if exists(select 1 from public.student_enrollments e where e.academic_year_id=p_target_year_id and e.class_id=v_target_class_id and e.roll=v_roll) then raise exception 'Roll % is already assigned in the destination class for academic year %.',v_roll,v_target_year; end if;

    update public.student_enrollments set enrollment_status='completed',completed_at=now() where student_id=v_student_id and academic_year_id=p_source_year_id and class_id=p_source_class_id and enrollment_status='active';
    insert into public.student_promotions(student_id,academic_year_id,from_class_id,to_class_id,promotion_status,promoted_at,remarks) values(v_student_id,p_target_year_id,p_source_class_id,v_target_class_id,v_status,now(),nullif(trim(coalesce(p_remarks,'')),''));
    insert into public.student_enrollments(student_id,academic_year_id,class_id,roll,enrollment_status,enrolled_at,remarks) values(v_student_id,p_target_year_id,v_target_class_id,v_roll,'active',now(),nullif(trim(coalesce(p_remarks,'')),''));
    update public.students set class_id=v_target_class_id,academic_year_id=p_target_year_id,roll=v_roll,updated_at=now() where id=v_student_id;
    v_processed:=v_processed+1;
  end loop;
  return v_processed;
end;
$function$;