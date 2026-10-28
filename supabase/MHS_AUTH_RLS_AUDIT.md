# MHS Supabase Auth and RLS hardening

Date: 2026-10-28

## Scope
- Protected admin and teacher portal routes with Supabase Auth session checks.
- Require active `user_profiles` role to match the portal.
- Fail closed if session/profile verification cannot complete.
- Portal logout now signs out of Supabase.
- Added scoped RLS policies to previously policy-less tables.

## Supabase changes applied
Migration name: `mhs_auth_rls_hardening`

- `public.teachers`: active super admins only (this table contains legacy password fields).
- `public.student_documents`: active super admin full access; assigned active teachers read only for their class/year.
- `public.student_enrollments`: active super admin full access; assigned active teachers read only for their class/year.
- `public.student_fees`: active super admin only.
- `public.student_promotions`: active super admin only.
- `public.student_subjects`: active super admin full access; students read their own subject selections; teachers read selections for assigned class/subject/year.
- `public.teacher_notifications`: active super admin full access; teachers read/update only their own notifications.
- Revoked public/anon/authenticated execute on `public.rls_auto_enable()`, an internal DDL event-trigger function.
- Restricted `public.review_result_edit_request(uuid,text,text)` to authenticated callers; the function itself validates active super-admin role and permitted status.

No application rows were intentionally changed or deleted.

## Verification status
- Supabase migration tool reported success.
- Security advisor re-run: previous warnings for tables with RLS but no policies and public/anon execution of `rls_auto_enable()` no longer appear.
- Remaining advisor warnings: `review_result_edit_request` is SECURITY DEFINER and executable by authenticated users (intentional for the admin UI; function body checks active super-admin); leaked-password protection is disabled and should be enabled in Supabase Auth settings.
- Browser end-to-end testing (admin/teacher login, invalid roles, disabled accounts, logout, and feature regression) has not been completed from this integration.

## Important limitations
- Student portal login still uses legacy localStorage/sessionStorage and has not been migrated to Supabase Auth.
- Teacher portal feature data still has legacy localStorage-backed sections. RLS protects Supabase data, not browser-local data.
- This work is not a complete migration of all application modules to Supabase.
- Do not treat the UI route guard as a substitute for RLS.
