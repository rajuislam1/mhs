-- Teacher portal: show the official timetable for every class/year assigned to the logged-in teacher.
-- Keep teacher_id matching, but relax subject equality to avoid hiding routine entries
-- when an Admin changes a subject assignment after publishing the class timetable.
drop policy if exists "Teachers can view routines for assigned classes" on public.class_routines;
create policy "Teachers can view routines for assigned classes"
on public.class_routines
for select
to authenticated
using (
  routine_status = true
  and exists (
    select 1
    from public.user_profiles profile
    join public.teacher_assignments assignment
      on assignment.teacher_id = profile.teacher_id
    where profile.id = (select auth.uid())
      and profile.role = 'teacher'
      and profile.is_active = true
      and assignment.status = true
      and assignment.teacher_id = class_routines.teacher_id
      and assignment.class_id = class_routines.class_id
      and assignment.academic_year_id = class_routines.academic_year_id
  )
);
