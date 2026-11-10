# Show the verified workbook in the app

The local code now reads the imported workbook. This is the first, read-only integration: original records are not editable. Existing development demo accounts keep their separate demo workflows.

## 1. Enable database read access

Open `supabase/migrations/20261103_workbook_read_access.sql` in VS Code. Copy its entire contents.

In Supabase: SQL Editor → New query. Save the query as **Enable Verified Workbook Read Access**. Paste the SQL and click Run once. The transaction adds scoped SELECT policies and two summary/filter functions; it does not change the imported values or assign account roles. Do not paste this Markdown guide into SQL Editor.

If it reports an error, keep the error message and do not disable RLS or delete existing tables. This migration has not been run remotely by the coding agent.

## 2. Sign in with a real account

Use email/password sign-in, rather than Open demo. The account must have administrator-assigned `app_metadata`:

| Role | Required coverage | Read access |
|---|---|---|
| CRO / CRO Manager | role | Imported cases across companies and cities |
| Client | role, company | Exact matching company |
| FSO | role, officer_name, city | Exact matching assigned FSO and city |
| SFSO / SOM | role, city | Matching city; Islamabad also includes Rawalpindi |

Use the exact company, city and officer spelling saved in the sheet. Do not use demo officer names unless the sheet actually contains them. Editable user metadata is never used for authorization. Supervisor sign-in currently supports Islamabad, Lahore and Karachi as in the existing app.

Refresh the account session after an administrator changes coverage. Do not assign a broad role just to make missing records appear.

## 3. Check the screens

- CRO/Manager dashboard should show 30,609 total, 76 Pending and 30,532 Closed for this snapshot. One case has no status.
- Other accounts see only their permitted records. A properly scoped account can legitimately have no assigned records.
- Case Board / My Cases loads 50 rows per page, with server-side search and company/city/status filters.
- Click a Case ID for all 58 original fields, cell notes and imported evidence links. Duplicate Case IDs stay separate using source sheet and row.
- Reports supports reported-date filters and explicitly exports the current page only.
- Profile contains appearance and sign-out controls.

The first integration does not provide live dispatch, messaging, field report uploads or editing of imported records. Those require a separate operational workflow store and write permissions; demo actions do not update Supabase. Imported hyperlinks reference existing files; the files themselves have not been migrated.

The successful saved-value verification covers the 58 raw fields, notes and links. It does not by itself verify formula/raw-cell JSON metadata or every typed conversion. Preserve the workbook and local backups.
