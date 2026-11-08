-- Allow students to read only academic-year labels for years in which they are enrolled.
drop policy if exists "Students can view enrolled academic years" on public.academic_years;
create policy "Students can view enrolled academic years"
on public.academic_years
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    join public.student_enrollments e on e.student_id = p.student_id
    where p.id = (select auth.uid())
      and p.role = 'student'
      and p.is_active = true
      and e.academic_year_id = academic_years.id
  )
);
