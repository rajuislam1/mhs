# MHS Supabase Auth and RLS audit

Date: 2026-10-28

## Audit scope
- GitHub auth and account-management changes on `feature/supabase-auth-route-guards`.
- Supabase public-schema table grants, RLS flags, policies, security-definer functions, migration history, and Security Advisor.
- JavaScript syntax checks on the changed authentication/account API and portal scripts.
- No browser end-to-end login test was run because this audit session cannot enter real credentials into the deployed site.

## Verified database changes
The following migrations are present in Supabase migration history:
- `mhs_auth_rls_hardening`
- `mhs_student_portal_own_data_policies`
- `secure_result_edit_request_review`
- `mhs_restrict_anon_teacher_profile_grants`

The queried public tables have RLS enabled. The relevant policy audit confirmed:
- Students can read only their own student row, published results and fee rows when linked to an active student profile.
- Teachers' result and attendance access is scoped to active teacher profiles and assigned classes/subjects/academic years.
- Active Super Admin policies govern sensitive admin-managed records such as teachers, student fees, student documents and student enrollments.
- `review_result_edit_request(uuid,text,text)` is SECURITY INVOKER, checks the active Super Admin profile in its function body, and is granted to authenticated and service_role only.
- Public anonymous grants on `teacher_public_profiles` were broader than needed. A new migration revoked all anonymous table privileges and granted SELECT only. Re-query verified anon now has SELECT only. The existing RLS policy limits public reads to published profiles.
- No application rows were intentionally updated or deleted by these audit changes.

## Security Advisor
The latest Security Advisor result contains one warning:
- `auth_leaked_password_protection`: leaked-password protection is disabled. This was previously identified as unavailable under the project's current Free plan. No other security advisor findings were returned by the latest check.

## Code checks and fixes made during this audit
- Fixed over-escaped roll-number validation in `api/student-login.js`; numeric roll input now matches the intended 1–6 digit pattern.
- Fixed over-escaped optional-email validation in `api/create-teacher.js` and `admin/teacher-accounts.js`.
- Fixed over-escaped photo URL validation in `admin/extra.js`.
- Fixed regular-expression parsing in `api/create-student-portal-account.js`.
- Fixed teacher session username precedence in `teacher/login.js`: the current username returned from the database now takes priority over potentially stale Auth metadata, so editing a teacher username does not keep the old username in the dashboard session.
- Replaced Teacher Portal's self-managed localStorage class/subject list with the official read-only `teacher_assignments` Supabase data.
- Replaced Teacher Portal routine add/list/delete handlers with Supabase `class_routines` queries; teachers can choose only active assigned class/subject/year combinations.
- Added and verified RLS INSERT, SELECT, and DELETE policies on `class_routines`, binding routine ownership to the signed-in active teacher and the exact active assignment.
- Replaced Teacher Portal result entry with Supabase queries for active assignments, assigned students, subjects and academic years. New results are saved as drafts; published-result corrections are blocked until an Admin approves an edit request.
- Replaced Admin result management with Supabase-backed result listing, publish/unpublish, deletion, and result-edit-request approval/rejection. Student-facing RLS remains restricted to published results owned by the signed-in student.
- Added and verified result RLS policies: teachers may insert assigned draft results and update assigned draft results or published results with an approved edit request; active Super Admins can manage all results.
- Adjusted teacher account editing so an internal synthetic login email is not required to be entered manually.
- Updated migration notes to describe the actual roll-number + password student login and the user's decision not to migrate legacy website data.
- JavaScript syntax checks passed for the audited API and portal scripts after these fixes. This is a syntax check, not a live integration test.

## Important live-data observation
The current Supabase teacher row returned by the read-only audit has username `testteacher`, no email stored, and both the teacher status and linked profile are inactive. I did not activate it or alter its data. Such a row will not be able to log in until an authorized admin provisions/activates the intended account through the new workflow.

## Remaining blockers before production merge
1. The Vercel Preview environment must contain `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the previously reported server-configuration error indicates at least one deployment was missing these variables. Preview and Production are separate environment scopes.
2. Real browser tests remain outstanding: admin login, teacher username login, student roll + password login, incorrect password, inactive account, wrong role, logout, direct portal URL, student ownership isolation, result draft/publish flow, edit approval/rejection, and admin/teacher feature regression.
3. Teacher routines, assignments, results and result-edit request flows still contain localStorage-backed implementation. These are not fully migrated to Supabase. The request to avoid legacy data migration does not mean those feature implementations have already been rewritten to database-backed workflows.
4. Admin admission approval (`window.apOk` in `admin/extra.js`) still creates only a localStorage student record and does not provision a Supabase student/Auth record. It must be wired to a database-backed admission/student workflow before the full student workflow can be called migrated.
5. Teacher routines, assigned classes, student lists, results and some edit-request UI still read/write localStorage; the result-edit page includes a Supabase path, but the complete teacher workflow is not migrated.
6. Confirm all changed files against the production branch before merging. Do not claim full migration or production readiness based only on a successful Vercel build.

## Data safety
No legacy localStorage data was imported, overwritten or deleted. The SQL change in this audit only narrows anonymous table privileges on `teacher_public_profiles`.
