# MHS Supabase Full Migration — Code Audit

Repository: `rajuislam1/mhs`
Target branch: `main`
Audit scope: all tracked text files in the current repository tree, with focused review of the public pages, Admin Portal, Teacher Portal, Student Portal, shared JavaScript, API routes, and existing SQL.

## Migration requirements

- Do not migrate legacy browser data. The owner confirmed old localStorage data is not required.
- Preserve existing pages, visual design, navigation, and user-facing features.
- Make Supabase the persistent source of truth for all dynamic website data.
- Keep Supabase Auth and enforce authorization in database policies/server routes, not only in the browser.
- Never expose the Supabase service-role key in client-side files.
- Do not drop or truncate existing database objects as part of a setup script.
- Do not claim production verification until the SQL is run against the real project and workflows are tested.

## Audit findings

### Existing Supabase-backed features

- `js/supabase.js`: initializes Supabase JS client with the project's publishable key.
- Admin and Teacher login files use Supabase Auth and query `user_profiles`.
- Teacher account management uses `teachers`, `user_profiles`, `classes`, `subjects`, `academic_years`, and `teacher_assignments`.
- Teacher assignment creation and listing have Supabase implementations.
- Admin Notice Management performs Supabase select/insert/update/delete on `notices`.
- Public notice pages query `notices`.
- Teacher result edit requests use `result_edit_requests`; teacher result reads query `results`, `class_subjects`, and assignments.
- Server API routes `api/create-teacher.js`, `api/manage-teacher.js`, and `api/manage-public-teacher.js` use server environment variables, including the service-role key server-side.

### Local Storage / browser-only features found

- `admin/admin.js`: dashboard counts, teacher/public-profile views, results, result edit requests, gallery/achievements, school settings, and several admin screens still read/write legacy keys.
- `admin/extra.js`: student records, class/subject mappings, subject catalogue, admission applications, class promotion, fees, hero images, teacher/public profile helpers, and related edits use localStorage helpers.
- `admin/enhancements.js`: retains localStorage helpers and a legacy teacher-account workflow alongside Supabase assignment code.
- `admin/teacher-accounts.js`: includes localStorage compatibility/fallback helpers around the newer Supabase account and assignment workflow.
- `admin/backup.js`: exports browser localStorage. This needs to become a database backup/export feature or be clearly scoped as a browser-preferences export.
- `js/core.js`: `mhsGet` and `mhsSet` are synchronous localStorage helpers; marksheet generation depends on them.
- `js/result-utils.js`: subject catalogue, class-subject structure, student lookup, result reads, and result writes use localStorage.
- `js/site.js`, `js/header.js`, and the inline scripts in `index.html`, `about.html`, and `gallery.html`: public settings, ticker, hero slides, gallery, achievements, and statistics use localStorage.
- `admission-apply.html`: application submission uses localStorage.
- `results.html` and `student.html`: public result lookup uses localStorage.
- `student/login.html` and `student/index.html`: student authentication/session and portal data are browser/localStorage-based; this must be moved to Supabase Auth and authorized queries.
- `teacher/teacher.js`: the main teacher dashboard still contains localStorage paths for results, routines, and student data even though its result-edit-request section already uses Supabase.
- `js/i18n.js`: stores language preference in localStorage. This is a browser preference and does not need to become database data.

## Dynamic data domains that need database persistence

1. School profile/settings and public statistics.
2. Notices and ticker message.
3. Public teacher profiles.
4. Hero images, gallery images, and achievements (image files should use Supabase Storage; database rows should store object paths/metadata).
5. Students and enrollment/class/section/roll data.
6. Student authentication/profile and portal access.
7. Admission applications and approval/rejection workflow.
8. Class promotion/history.
9. Class and subject catalogue, class-subject mapping, academic years.
10. Exam/result records and marksheet data.
11. Teacher accounts, teacher profiles, and teaching assignments.
12. Result edit requests and their review status.
13. Fees/payment records.
14. Class routines.
15. Backup/export and audit history.

## Security requirements

- Admin-only write permissions for school settings, admissions decisions, student management, fees, class/subject setup, routines, notices, gallery, and teacher account administration.
- Teachers must only read data needed for their active teaching assignments and only submit/edit results for assigned class/subject/year combinations.
- Students must sign in through Supabase Auth and only read their own profile, results, and fee information.
- Public/anonymous access should be limited to explicitly published public content and approved result lookup rules.
- Do not store student passwords or password hashes in custom tables; use Supabase Auth.
- Existing server routes must continue to keep the service-role key server-side.

## Planned file groups

### Shared/public site
- `js/supabase.js`, `js/core.js`, `js/data.js`, `js/site.js`, `js/header.js`, `js/result-utils.js`
- `index.html`, `about.html`, `gallery.html`, `notices.html`, `results.html`, `student.html`, `teachers.html`, `admission-apply.html`

### Admin
- `admin/admin.js`, `admin/extra.js`, `admin/enhancements.js`, `admin/teacher-accounts.js`, `admin/backup.js`, `admin/login.js`, `admin/index.html`, `admin/login.html`

### Teacher and student portals
- `teacher/teacher.js`, `teacher/enhancements.js`, `teacher/login.js`, `teacher/index.html`, `teacher/login.html`
- `student/login.html`, `student/index.html`

### Backend/SQL
- `api/create-teacher.js`, `api/manage-teacher.js`, `api/manage-public-teacher.js`, `api/academic-year.js`
- `supabase/migration-step-1-inspect.sql` and a complete, non-destructive schema/policy setup script.

## Important implementation note

The current application uses synchronous localStorage calls throughout many screens. A correct migration cannot be achieved by replacing a few strings or by mirroring private data into a single public JSON row. Each domain needs proper database queries, loading/error handling, and role-scoped RLS. This report records the audit baseline; it is not a claim that the migration is already implemented or tested.


## Implementation progress — 2026-10-31

A working branch `fix/supabase-full-migration-2026-10-31` was created from `main`. The changes below are on this branch only; production/main has not been changed.

### Implemented on the branch
- `js/site.js`: replaced the homepage's LocalStorage-backed settings/notices/ticker/gallery/statistics reads with Supabase queries. Language preference remains intentionally browser-local.
- `index.html`: removed the separate homepage gallery renderer that read `mhs_gallery` from LocalStorage.
- `about.html`: reads school profile text from `school_settings`, with static `SITE` content as a display fallback if no settings row exists.
- `gallery.html`: reads published gallery and achievement records from the existing Supabase tables.
- `notices.html`: removed the LocalStorage/demo-data fallback; database failures now show an explicit unavailable message.
- `admission-apply.html`: submits applications to the existing `admission_applications` table, using the selected class ID and pending status.
- `api/public-result.js`: added a server-side endpoint that returns only published results for the requested class/roll/year/exam; service-role credentials remain server-side.
- `results.html` and `student.html`: public result searches now use that endpoint instead of reading browser-local results.
- Syntax checks were run against changed inline scripts and `js/site.js`; no JavaScript parse errors were detected.

### Supabase schema observations
- The project is active and has RLS enabled on the inspected public tables.
- Existing tables include school settings, notices/tickers, students/enrollments, teachers/public profiles, classes/subjects/class-subject mappings, results, admission applications, fees, routines, gallery, achievements, and user profiles.
- At inspection time, several feature tables were empty (including `school_settings`, `gallery`, `achievements`, `admission_applications`, `student_fees`, and `class_routines`). The homepage/about page therefore need sensible display fallbacks until the admin UI writes these records to Supabase.
- The existing `teachers` table contains a `password` column. This requires a security review and careful transition to Supabase Auth; do not store or use plaintext/custom password values.
- Security/performance advisors reported multiple permissive RLS policies and unused indexes. Those findings require individual review; policies should not be dropped wholesale.

### Still incomplete — do not treat this migration as finished
- `admin/admin.js`, `admin/extra.js`, `admin/enhancements.js`, and `admin/teacher-accounts.js` still contain legacy LocalStorage CRUD paths. Admin dashboard, student CRUD, academic subjects/mappings, promotion, fees, hero management, settings, gallery/achievements, and backup are not fully migrated.
- `teacher/teacher.js` still uses LocalStorage for routines, student lists, and result-entry paths; only some assignment/result-edit-request functionality is Supabase-backed.
- `student/login.html` and `student/index.html` still use browser-local student credentials/session/data. Student Auth provisioning and student-only portal queries are not yet migrated end-to-end.
- Public teacher profile management, storage upload paths, and school-settings CRUD need end-to-end testing.
- The new public result endpoint needs runtime testing on Vercel and appropriate abuse/rate-limit controls before production.
- Admission form field mapping and all CRUD paths need functional tests with real UI submissions.
- No SQL schema migration was applied in this pass, and no production deployment was performed.
- No legacy browser data is imported, as explicitly requested by the owner.

### Verification limits
Only static JavaScript syntax checks and live Supabase schema/policy/row-count inspection were completed in this pass. Login, form submission, RLS boundaries, browser workflows, Vercel environment variables, and production deployment still need end-to-end verification.


## Implementation progress — 2026-10-31

Implemented on branch `fix/supabase-full-migration-2026-10-31` (not yet merged to production):

- Added `admin/content.js`: Admin dashboard counts and School Settings, Notices/ticker, Gallery/Achievements, Student database, and Result Management now read/write Supabase instead of relying on browser-localStorage for those workflows.
- Added secure server-side student account endpoints:
  - `api/create-student.js`: checks the authenticated active Super Admin, creates a student record and Supabase Auth account, links the account through `user_profiles`, and rolls back the student record if account provisioning fails.
  - `api/manage-student.js`: lets only an active Super Admin activate/deactivate a student and linked portal profile.
  - `api/student-login.js`: accepts Student ID or Admission No. plus password, checks the active student/profile, then delegates password verification to Supabase Auth. The service-role key remains server-side.
- Replaced the browser-localStorage Student Login with the server-assisted Supabase Auth flow; replaced the student portal page with authenticated, RLS-protected reads for the student's own profile, published results, subjects, and fees.
- Teacher portal now revalidates the Supabase Auth user and active teacher profile before rendering the dashboard; admin and teacher logout call Supabase Auth sign-out.
- Admin backup now exports central Supabase tables to JSON and deliberately omits the `teachers.password` column.
- Fixed the public results page so it has one result handler and uses the server-side published-result endpoint.

### Final implementation and verification status — 2026-10-31

Latest branch includes:
- Supabase-only Admin dispatcher. The Admin page no longer loads the legacy browser data/result helper scripts.
- Supabase CRUD for school settings, notices/ticker, public teacher profiles, gallery, achievements, hero images, students/accounts, subjects, student subject selection, class promotion/history, admissions, fees, result publication and result edit-request review.
- Teacher Portal rewritten to use authenticated Supabase queries and RLS for active assignments, class routines, draft result submission, published-result correction requests, student lists, and result status.
- Student Portal authentication and profile/results/subject/fee reads use Supabase Auth and RLS.
- Public teacher profiles no longer fall back to browser LocalStorage.
- Student and teacher account activation/deactivation are wired to the linked `user_profiles` state; teacher reactivation is included.
- Supabase database backup covers school content, student records, teacher/profile data, assignments, results, routines, fees, promotions and other school tables; it deliberately omits `teachers.password`.
- Added `hero_images` table with RLS policies for active public reads and active Super Admin CRUD. The public homepage hero slider now reads from this table.
- Public result lookup filters to active students and published result rows. GPA calculation returns zero if any subject has zero grade points.
- Legacy localStorage data is not imported, as explicitly requested.

### Checks completed
- Queried live Supabase table definitions, foreign keys, row-level-security enabled status and public/anonymous policies.
- Confirmed all current public-schema base tables have RLS enabled.
- Confirmed no non-null legacy values exist in `teachers.password` (the column itself has not been dropped, to avoid breaking any older deployed code before rollout).
- Re-ran Supabase Security Advisor. The only security lint reported is that Auth leaked-password protection is disabled. No connected API in this environment can toggle that dashboard-level Auth setting.
- Added GitHub Actions static JavaScript syntax checks for changed files.
- GitHub PR #2 is ready for review and points to `main`; the Vercel status for the latest revision was still pending when this audit was written.

### Explicit verification boundary
The repository code and schema have been updated, but authenticated browser end-to-end tests (creating/logging in/deactivating/reactivating test accounts, saving records through every form, and downloading a backup) cannot be truthfully marked passed without a live deployed build, configured Vercel server environment variables, and a valid test administrator session. Do not label these tests passed unless they are actually executed. Production deployment should be confirmed from the Vercel status and then these role-based flows should be exercised in the browser.
