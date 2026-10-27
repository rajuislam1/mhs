# Mokhleshpur High School Website

Vercel-ready static HTML/CSS/JS website for Mokhleshpur High School, Birol, Dinajpur.

## Initial admin login

## Teacher login
1. Admin → Teachers & Accounts → Create Teacher Account.
2. Open `teacher/login.html`.
3. Login with the created username/password.

## Working admin modules
- Dashboard
- Notices: add/edit/delete + posting date/time + attachment URL
- Teachers & Accounts: create/delete teacher accounts and public teacher profiles
- Results: publish/edit/delete results
- Achievements & Gallery: add/edit/delete achievements and upload image previews into browser storage
- School Settings: edit school identity/content

## Teacher portal
- Dashboard
- Class Routine
- My Classes
- Publish/Edit/Delete Results
- Student result records

## Translation
The public website includes a Bengali/English toggle. The top information bar keeps EIIN/phone/email unchanged as requested; the rest of the main content can switch language.

## Important architecture note
This package is a static/localStorage version. Admin-created teacher accounts and content changes are available in the same browser/device where they are created. For real school-wide access from different devices, connect the UI to a secure database, authentication and file storage service.

## Deploy to Vercel
You can deploy this ZIP/folder directly with Vercel Drop or import it into GitHub and connect the repository to Vercel.


## Supabase migration — Step 1 (safe preparation)
- In Admin Portal, use **Download Data Backup** to export this browser's localStorage as a JSON file before migrating data.
- Run `supabase/migration-step-1-inspect.sql` in the Supabase SQL Editor. It is read-only and only reports schema, class/year IDs, policies, and row counts.
- This step does not migrate or delete records and does not change RLS policies.
