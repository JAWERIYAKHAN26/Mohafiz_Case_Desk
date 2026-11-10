# Supabase authentication setup

Forgot password flow: enter the account email, choose **Send reset code**, enter the code from the latest email, enter matching new passwords (at least eight characters), then sign in again after the app signs out the recovery session. Verification uses `verifyOtp` with `type: 'recovery'`; it does not create accounts or use passwordless sign-in. The recovery screen includes **Back to sign in**. Existing reset links remain supported.

Required hosted configuration: in Supabase **Authentication → Email Templates → Reset Password**, replace the body with the contents of `supabase/templates/recovery.html` and save. The `{{ .Token }}` placeholder sends the code; leaving the default template unchanged will continue to send a link instead. This repository file does not automatically change a hosted project's template.

Email OTP still uses the same email delivery quota as reset links. Supabase's built-in email provider currently allows only two emails per hour across the project. Configure custom SMTP under Authentication email settings and review Authentication rate limits for real use. The app has a 60-second resend cooldown, preserved across reloads within the tab; this does not reset or override the server's hourly quota. See https://supabase.com/docs/guides/auth/rate-limits and https://supabase.com/docs/guides/auth/auth-email-templates.

Verify with a real inbox after saving the template: request a code, confirm the resend cooldown, try an incorrect code, verify the latest correct code, confirm the new-password form appears without entering the portal, try mismatched passwords, save matching passwords, and sign in with the new password. Check expired/used codes are rejected. Do not repeatedly request new emails to test verification.

Use an actual deliverable email address for this check: the seeded `@case-desk.test` accounts cannot receive reset emails in a real inbox. Configure custom SMTP for delivery to real users and allow the application's recovery redirect URL in Supabase Authentication settings. Email delivery and redirect configuration must be verified in the Supabase project; code checks alone cannot confirm them.

For the manager-only Audit Logs page, apply `supabase/migrations/20261109_manager_audit_logs.sql` in the same Supabase project used by the frontend. A `PGRST202` error for `portal_audit_logs` means the API cannot find that function in its schema cache. If the migration has already been applied, verify the project and reload PostgREST's schema cache with `NOTIFY pgrst, 'reload schema';`.

1. Open the project's **Settings → API Keys** and copy the **publishable** key. Never use a secret or service-role key in Vite.
2. Copy `.env.example` to `.env.local`, fill in `VITE_SUPABASE_PUBLISHABLE_KEY`, then restart Vite.
3. Install dependencies with `npm install @supabase/supabase-js`.
4. In **Authentication → URL Configuration**, set your application's Site URL. Add `http://localhost:5173/**` for local development to Redirect URLs, plus the production application's URL when deployed. Reset emails return to `/?auth=recovery`.
5. In **Authentication → Users**, create the application accounts. Supabase dashboard accounts are separate from application accounts. No public signup is enabled in this app.
6. Assign access using administrator-controlled `app_metadata`. In the SQL Editor, replace the example email and values before executing:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"role":"CRO","display_name":"CRO"}'::jsonb
where email = 'replace-with-actual-company-email@example.com';
```

Supported roles: `CRO`, `CRO Manager`, `SFSO`, `SOM`, `FSO`, `Client`.

- SFSO/SOM also need `city`: `Islamabad`, `Lahore`, or `Karachi`.
- FSO needs `city` and `officer_name` matching an existing officer in the app.
- Client needs `company` matching an existing company in the app.
- Never use editable `user_metadata` to authorize roles.

Verify valid/invalid login, reload/session restoration, logout, reset email, expired link, matching new passwords, and login with the changed password. Reset email delivery may need project SMTP configuration.

Only authentication is connected here. Cases and chat are still the app's in-memory data; role filtering in React does not replace server-side access control. Add database tables and RLS before storing production case data.
