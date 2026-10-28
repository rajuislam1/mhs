# MHS Vercel server environment variables

The API routes in `api/` require server-side Supabase credentials. These values must never be placed in frontend JavaScript or committed to GitHub.

In Vercel, open the MHS project → Settings → Environment Variables. Add both variables for **Preview** (required for pull-request preview testing) and **Production** (when the changes are approved for production). Add Development only if using Vercel local development.

## Required variables

- `SUPABASE_URL` = `https://wolxiieqyqeihvdefomd.supabase.co` (no trailing slash)
- `SUPABASE_SERVICE_ROLE_KEY` = the server-side Supabase service-role secret compatible with the current API code. In Supabase Dashboard → Project Settings → API Keys, use the legacy `service_role` secret if available. Never use the publishable/anon key here and never share the service-role secret in chat, screenshots, browser code, or GitHub.

Save the variables, then redeploy the latest preview deployment. Vercel does not retroactively inject newly added environment variables into an already-running deployment.

## Test after redeploy

1. Admin → Teachers & Accounts: create a test teacher with a unique username and password of at least 8 characters. Email is optional; if supplied, it must be valid.
2. Teacher Portal: test username + password. If an external login email was supplied, test email + password too.
3. Admin → Student Database: create a test student with a unique admission number, class, roll and password of at least 8 characters.
4. Student Portal: test roll number + password (the student does not need an email).
5. Deactivate each account and confirm login is rejected; reactivate and confirm login works.
6. Check direct portal URLs without a session, wrong-role access, logout, and that one student's session cannot read another student's data.

## Important behavior

- Student Portal users do not need to know or enter an email. The server creates an internal Supabase Auth email derived from the Supabase student UUID; the portal sign-in form accepts the roll number and password.
- Roll numbers can repeat across classes. If the same roll is shared by several active student accounts and the same password matches more than one account, the API rejects the ambiguous login. Set unique portal passwords for students who share a roll number, or decide on a class/roll login identifier before launch.
- Existing localStorage-only students and teachers are not automatically migrated. Create new test accounts through the Supabase-backed Admin form for this test.
