-- MHS Role-Based Access Control (RBAC): additive and non-destructive.
alter table public.user_profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists email text;

comment on column public.user_profiles.permissions is
  'Module-level permissions for admin/moderator accounts. Super Admin permissions are implicit and cannot be delegated.';

create or replace function public.mhs_has_admin_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and (
        p.role = 'super_admin'
        or (
          p.role in ('admin', 'moderator')
          and coalesce((p.permissions ->> permission_key)::boolean, false) = true
        )
      )
  );
$$;

revoke all on function public.mhs_has_admin_permission(text) from public;
grant execute on function public.mhs_has_admin_permission(text) to authenticated;

-- Delegated access is granted only for the modules selected by the Super Admin.
do $$
declare
  item record;
  policy_name text;
  predicate text;
begin
  for item in
    select * from (values
      ('academic_years','students'),
      ('achievements','gallery'),
      ('admission_applications','admissions'),
      ('class_routines','routine'),
      ('class_subjects','teachers'),
      ('class_subjects','students'),
      ('exam_routine_publications','examroutine'),
      ('exam_schedules','examroutine'),
      ('fee_payments','fees'),
      ('fee_templates','fees'),
      ('gallery','gallery'),
      ('notice_tickers','notices'),
      ('notices','notices'),
      ('result_edit_audit','results'),
      ('result_edit_requests','results'),
      ('results','results'),
      ('student_attendance','attendance'),
      ('student_documents','students'),
      ('student_enrollments','students'),
      ('student_fees','fees'),
      ('student_promotions','students'),
      ('student_subjects','students'),
      ('students','students'),
      ('subjects','students'),
      ('teacher_assignments','teachers'),
      ('teacher_notifications','teachers'),
      ('teachers','teachers')
    ) as x(table_name, permission_key)
  loop
    policy_name := 'mhs_rbac_' || item.table_name || '_' || item.permission_key;
    predicate := format('public.mhs_has_admin_permission(%L)', item.permission_key);

    -- Results are also needed by delegated Admit Card workflows.
    if item.table_name = 'results' then
      predicate := '(' || predicate || ' OR public.mhs_has_admin_permission(''admitcards''))';
    end if;
    if item.table_name in ('students','student_documents','student_enrollments') then
      predicate := '(' || predicate || ' OR public.mhs_has_admin_permission(''admitcards''))';
    end if;

    if item.table_name = 'result_edit_audit' then
      execute format(
        'create policy %I on public.%I for select to authenticated using (%s)',
        policy_name, item.table_name, predicate
      );
    else
      execute format(
        'create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
        policy_name, item.table_name, predicate, predicate
      );
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.academic_years,
  public.achievements, public.admission_applications, public.class_routines,
  public.class_subjects, public.exam_routine_publications, public.exam_schedules,
  public.fee_payments, public.fee_templates, public.gallery, public.notice_tickers,
  public.notices, public.result_edit_audit, public.result_edit_requests,
  public.results, public.student_attendance, public.student_documents,
  public.student_enrollments, public.student_fees, public.student_promotions,
  public.student_subjects, public.students, public.subjects,
  public.teacher_assignments, public.teacher_notifications, public.teachers
to authenticated;
