# MHS Full Supabase Migration — SQL Plan (No Legacy Data Import)

## Status

This is a plan, not an executable schema migration. First run `migration-step-1-inspect.sql` and review the result. The repository already uses tables such as `user_profiles`, `teachers`, `teacher_public_profiles`, `classes`, `subjects`, `academic_years`, `class_subjects`, `teacher_assignments`, `results`, `result_edit_requests`, and `notices`. Their actual column definitions and RLS policies must be inspected before any ALTER/CREATE/POLICY statements are generated. Do not drop or recreate these tables.

## Phase 1 — Inspect and freeze current schema

Run `supabase/migration-step-1-inspect.sql` in the Supabase SQL Editor and save the full result sets. Confirm:
- existing table columns and constraints;
- existing RLS enablement and policies;
- existing Storage buckets;
- which existing relations are used by Auth/teacher assignment/results flows.

## Phase 2 — Extend schema additively

After Phase 1, create only missing objects and add only missing columns/indexes. Expected domains:

| Domain | Suggested relation | Notes |
|---|---|---|
| Student profiles/enrollment | `students`, `student_enrollments` | Use Supabase Auth user ID for portal identity; keep student ID/admission number unique. Reuse existing table if compatible. |
| School settings | `school_settings` | One active settings record; admin write only, public read limited to safe published fields. |
| Admission | `admission_applications` | Public insert with field validation; admin-only review/approval. |
| Fees | `fees` | Admin writes; student reads only their own records. |
| Routines | `class_routines` | Admin writes; published schedules can be publicly read if intended. |
| Gallery/achievements | `gallery_items`, `achievements` | Store metadata in tables; image bytes in Supabase Storage. |
| Hero slides | `hero_slides` or reuse `gallery_items` with a placement field | Keep ordering and published status. |
| Ticker | `site_announcements` or `school_settings` field | Avoid duplicate sources of truth for notice/ticker text. |
| Result edit workflow | existing `result_edit_requests` | Reuse current table and policies. |
| Subjects/class mappings | existing `subjects`, `class_subjects`, `academic_years` | Preserve existing teacher assignment foreign keys. |

The exact names and columns should be finalized against the inspection output. Do not create duplicate tables when a compatible table already exists.

## Phase 3 — RLS and role model

- Admin: authenticated user with an active `user_profiles` row whose role is `admin`.
- Teacher: authenticated user with an active `user_profiles` row whose role is `teacher`; access is limited by active `teacher_assignments`.
- Student: authenticated user mapped to exactly one student record/enrollment; access is limited to their own record.
- Public/anonymous: only published notices, approved public teacher profiles, published gallery/achievements, and other explicitly public content.
- All sensitive writes must be enforced by RLS and/or server endpoints; hiding UI controls is not authorization.
- Never store plaintext passwords or custom SHA password hashes. Use Supabase Auth.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server-side environment variables, never in browser JavaScript.
- Storage policies must match the same public/private content rules.

## Phase 4 — Front-end data-access layer

The current app expects synchronous `mhsGet/mhsSet` localStorage access in many screens. Supabase is asynchronous, so a correct migration needs an async repository/data layer and each relevant screen must wait for its initial load. Do not implement a fake synchronous localStorage mirror for private data.

Migrate and test one domain at a time:
1. School settings, notices, public teacher profiles, hero/gallery/achievements.
2. Students, class/subject catalogue, class-subject mappings, academic years.
3. Student login and student portal.
4. Teacher result entry, result reads, routines, result edit requests.
5. Admission application/review, class promotion, fees.
6. Admin dashboard counts, backup/export, audit log.

## Phase 5 — Auth and server endpoints

- Keep current Supabase Admin/Teacher login where correct; confirm active role/profile checks.
- Move student login to Supabase Auth and an explicit student-to-auth-user mapping.
- Review `api/create-teacher.js`, `api/manage-teacher.js`, `api/manage-public-teacher.js`, and `api/academic-year.js` for method validation, session validation, role validation, input validation, and safe error responses.
- Any privileged write must be authenticated and authorized server-side.
- Add rate limiting / CAPTCHA to public admission submission if abuse risk warrants it.

## Phase 6 — Verification checklist

- Public home page loads when database is empty and when Supabase is unavailable; no private data is leaked.
- Admin login/logout and role checks work.
- Teacher login, deactivation, assignment create/list, result entry, and result-edit request workflows work.
- Student login only reveals that student's own results/fees.
- Admin student create/edit/delete, class promotion, fee entry, admission approval, routines, settings, notice/gallery CRUD work.
- RLS tests verify anonymous, teacher, student, and admin boundaries.
- No production page uses localStorage as the source of truth for shared school data.
- Browser preferences (language/theme) may remain in localStorage.
- Vercel deployment succeeds with environment variables set and no secret key in public files.

## Why schema inspection is a gate

The current repository already uses some Supabase relations and foreign keys. A guessed SQL migration could break existing Auth, assignments, results, or RLS policies. The inspection query is read-only and must be run before generating a safe, idempotent executable migration. No legacy browser data needs to be imported.
