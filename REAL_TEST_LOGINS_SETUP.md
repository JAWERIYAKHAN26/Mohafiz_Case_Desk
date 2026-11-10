# Real test logins for all 23 demo roles

The provisioner creates real Supabase email/password accounts using the Admin API. Roles and company/city/officer coverage go into trusted app_metadata. It creates no cases and changes no existing account passwords, roles or case assignments. It does not run the archive worker.

## Run

The private `.env.archive.local` file already exists in the project root. It contains the project URL and an empty backend key placeholder. Set `ARCHIVE_SERVICE_ROLE_KEY` to the backend service-role key from Supabase Settings → API Keys (legacy service_role key if shown). Never use a publishable key here. Do not share the key in chat or add it to Vite variables. This credential is used only by the Node admin script.

In the project root terminal:

```powershell
node --env-file=.env.archive.local scripts/admin/create-test-users.mjs --create
```

This command only creates the test accounts. It does not archive or delete cases. Without `--create` the script prints the plan and changes nothing.

## Credentials

Open `outputs/test-accounts/real-test-logins.csv` after completion. Each newly created user has a separate random password and automatically confirmed email. The private JSON journal is saved before each remote request so partial runs can be retried without losing generated credentials. Both files are under git-ignored outputs. Keep them private and retain the JSON journal when rerunning.

These addresses use reserved `case-desk.test` inboxes: they work for password login but do not receive emails or password reset messages. Existing users with the same address are skipped and marked `existing-unmodified`; no usable password is supplied for those accounts. Provisioner-created accounts are tagged `test_account=true` and a run ID for later identification.

## Coverage

23 accounts: CRO, CRO Manager, three SFSOs, three SOMs, twelve FSOs and three Clients (PostEx, Daraz, Buscaro). Use the real Sign in form, not Open demo.

FSO accounts use the same officer names shown in the existing demo list. Imported records require exact matching assigned_fso and city. If the actual workbook uses other names, these accounts correctly see no cases. Do not grant broader coverage or relabel original records to populate the test view. Additional actual-officer test accounts require the correct real roster.

Clients similarly see exact matching company values. Supervisors see their own city (Islamabad also covers Rawalpindi). CRO and CRO Manager can read all imported cases.

Production dispatch/chat/acknowledgement/closure functionality is still pending backend integration; creating accounts does not complete those workflows or restore all role-specific demo screens. Use these logins to inspect the current real-data interface and scope.

No accounts were created by the coding agent because the backend credential is not yet configured. No credentials should be guessed from the planned email list.
