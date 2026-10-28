# MHS Auth migration plan and verification

Updated: 2026-10-28

## Implemented on feature/supabase-auth-route-guards
- Admin sign-in uses Supabase Auth email/password, then requires a matching active `user_profiles.role = 'super_admin'`.
- Teacher sign-in uses Supabase Auth email/password, then requires a matching active `user_profiles.role = 'teacher'`.
- Protected Admin, Teacher and Student portal routes now validate the Supabase session and active role. Route checks fail closed if verification cannot complete.
- Student sign-in accepts roll number + password. The server resolves the roll number to the linked Supabase Auth identity, validates the password, then requires `role = 'student'`, active portal status, and a linked `student_id`. Internal Auth email is not shown to students.
- Student dashboard now queries the authenticated student's profile, subjects, published results and fee records from Supabase instead of reading student identity/results/fees from localStorage.
- Supabase RLS policies added for students to read their own student row, published results and fee rows.
- Profile validation failures now sign out Admin/Teacher accounts rather than leaving an authenticated but unauthorized session behind.

## Test results
- Database policy verification: PASS. New student policies are present in `pg_policies`.
- Security advisor: previous missing-RLS-policy and public/anon event-trigger execution findings are absent.
- Browser end-to-end tests: NOT RUN. This integration cannot enter real account credentials into the hosted website.
- Valid/invalid login, inactive account, wrong-role account, logout, direct URL, and data ownership tests must be run using actual provisioned test accounts before merge.
- Existing Admin and Teacher account credentials must correspond to Supabase Auth users and `user_profiles` rows.

## Student account provisioning prerequisite
The new Student login expects a Supabase Auth user and a `user_profiles` row whose `id` equals the Auth user UUID, `role='student'`, `is_active=true`, and `student_id` points to `public.students.id`. The server creates an internal synthetic Auth email for each newly provisioned student account; students sign in with roll number + password. Existing localStorage-only accounts are not imported. As requested, no old website data migration is planned; use fresh Supabase-backed accounts for the new authentication flow. No existing application data was deleted.

## Remaining Teacher portal scope (not part of legacy-data migration)
Teacher portal still stores these modules in localStorage and they are not yet wired to Supabase:
- `mhs_routines`: move to a class routine table with teacher/class/subject/year foreign keys and policies limiting writes to assigned teachers.
- `mhs_teacher_classes`: replace teacher-created class/subject entries with `teacher_assignments` managed by an active super admin; teachers should not self-assign subjects.
- `mhs_results`: move to `results` + `class_subjects`, with server-side ownership checks; map exam names to `exam_types` where possible.
- `mhs_result_edit_requests`: move to result-edit request table/function and teacher notifications, preserving admin approval.
- Student lookup and marksheet data: read from `students`, `student_enrollments`, `results`, and related academic tables under RLS.

These modules need new Supabase-backed implementations and role/RLS checks if they are included in the requested scope. Do not copy old browser localStorage automatically or overwrite database rows. The current Teacher dashboard still has localStorage-backed modules; the new guard is not a substitute for moving their read/write logic to Supabase.

## Remaining security configuration
- Leaked-password protection is not available on the current Free Plan. The project will remain on Free Plan; this feature is an acknowledged limitation, not a reason to upgrade. Keep password length/strength settings as strong as the dashboard permits and use unique passwords.
- Hardened `public.review_result_edit_request(uuid,text,text)`: changed it to `SECURITY INVOKER`, added an RLS UPDATE policy limited to active Super Admins reviewing pending requests, and revoked PUBLIC/anon execution while retaining authenticated execution for the admin UI. Supabase Security Advisor no longer reports the SECURITY DEFINER warning. Browser tests must still verify teacher/unauthorized requests cannot approve or reject requests.
- Before production merge/deploy, run real-account browser tests and feature regression checks. Do not treat client-side route guards as the data-security boundary; RLS and server-side authorization must enforce access.

## Super Admin account activation controls (added to feature branch)
- Teacher Accounts now offers Activate for inactive database-backed teacher records. The server API synchronizes `teachers.status` and the linked teacher `user_profiles.is_active`; deactivation preserves the records.
- Added a Student Portal Accounts admin section and server-only API to create Supabase Auth login accounts for existing Supabase student records, link them to `user_profiles`, and activate/deactivate their portal access. Students sign in with roll number and password; an internal synthetic Auth email is never shown to them.
- Student portal access activation is kept separate from the student's underlying enrollment record status.
- The Admin → Student Database creation form now writes new students to Supabase and creates the linked Auth account/profile in one server-side workflow, then mirrors the newly created record in localStorage for legacy modules. Password must be at least 8 characters.
- Teacher username/email login and student roll-number login API routes require Vercel Preview environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. See `supabase/VERCEL_ENV_SETUP.md`; the service-role key remains server-side only.
- Demo account creation and real login tests remain pending. After setting Vercel Preview environment variables and redeploying, create a new test teacher and a new test student using unique test details. Do not use an existing real student's identity for a demo.
