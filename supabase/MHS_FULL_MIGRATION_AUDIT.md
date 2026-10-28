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
