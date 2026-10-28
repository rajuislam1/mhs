# MHS Auth migration plan and verification

Updated: 2026-10-28

## Implemented on feature/supabase-auth-route-guards
- Admin sign-in uses Supabase Auth email/password, then requires a matching active `user_profiles.role = 'super_admin'`.
- Teacher sign-in uses Supabase Auth email/password, then requires a matching active `user_profiles.role = 'teacher'`.
- Protected Admin, Teacher and Student portal routes now validate the Supabase session and active role. Route checks fail closed if verification cannot complete.
- Student sign-in now uses registered email/password through Supabase Auth and requires `role = 'student'`, active status, and a linked `student_id`.
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
The new Student login expects a Supabase Auth user and a `user_profiles` row whose `id` equals the Auth user UUID, `role='student'`, `is_active=true`, and `student_id` points to `public.students.id`. The old login accepted Student ID/admission number and a locally hashed password; that password is not portable to Supabase Auth. Student accounts therefore need to be provisioned with registered email addresses and reset/set passwords. No old application data was deleted.

## Teacher localStorage migration plan
Teacher portal still stores these modules in localStorage and they are not yet migrated:
- `mhs_routines`: move to a class routine table with teacher/class/subject/year foreign keys and policies limiting writes to assigned teachers.
- `mhs_teacher_classes`: replace teacher-created class/subject entries with `teacher_assignments` managed by an active super admin; teachers should not self-assign subjects.
- `mhs_results`: move to `results` + `class_subjects`, with server-side ownership checks; map exam names to `exam_types` where possible.
- `mhs_result_edit_requests`: move to result-edit request table/function and teacher notifications, preserving admin approval.
- Student lookup and marksheet data: read from `students`, `student_enrollments`, `results`, and related academic tables under RLS.

Migration must be staged module by module with read-only comparison tests before writes are switched. Do not copy old browser localStorage automatically or overwrite database rows. The current Teacher dashboard still has localStorage-backed modules; the new guard is not a substitute for data migration.

## Remaining security configuration
- Leaked-password protection is not available on the current Free Plan. The project will remain on Free Plan; this feature is an acknowledged limitation, not a reason to upgrade. Keep password length/strength settings as strong as the dashboard permits and use unique passwords.
- Hardened `public.review_result_edit_request(uuid,text,text)`: changed it to `SECURITY INVOKER`, added an RLS UPDATE policy limited to active Super Admins reviewing pending requests, and revoked PUBLIC/anon execution while retaining authenticated execution for the admin UI. Supabase Security Advisor no longer reports the SECURITY DEFINER warning. Browser tests must still verify teacher/unauthorized requests cannot approve or reject requests.
- Before production merge/deploy, run real-account browser tests and feature regression checks. Do not treat client-side route guards as the data-security boundary; RLS and server-side authorization must enforce access.

## Super Admin account activation controls (added to feature branch)
- Teacher Accounts now offers Activate for inactive database-backed teacher records. The server API synchronizes `teachers.status` and the linked teacher `user_profiles.is_active`; deactivation preserves the records.
- Added a Student Portal Accounts admin section and server-only API to create Supabase Auth login accounts for existing Supabase student records, link them to `user_profiles`, and activate/deactivate their portal access.
- Student portal access activation is kept separate from the student's underlying enrollment record status.
- These controls require the Vercel environment variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to be configured. The service key remains server-side only.
- Demo account creation and real login tests remain blocked until the feature branch is deployed to a test environment and a Super Admin signs in to create a test account. Do not use an existing real student's identity for a demo.
