# Ten-day closed-case archive

## What is implemented

Daily archive eligibility uses the case's typed closure date (`closure_date_iso`), never the import date or last update date. Status must be exactly `Closed`. With date-only closures, ten full days are retained after the end of the closure day in Pakistan time: closure date must be strictly before today's PKT date minus ten. Missing/invalid dates and open cases are skipped. Old imported closed cases can therefore qualify on the first run.

The job processes 20 cases per transaction batch until no eligible cases remain. Each batch writes a private Excel-compatible XML workbook (cases, notes, links, field reports, and long-text sheets), an exact JSON snapshot including formula/raw metadata and typed fields, and a manifest of SHA-256 checksums. Excel cells are strings, preserving leading zeroes and preventing formulas from executing. JSON retains the distinction between null and empty text and the original numeric text emitted by PostgreSQL. Very long cells are split into numbered Long text rows; do not discard that sheet. XML-incompatible control characters are displayed as escapes; the JSON snapshot retains original bytes.

Existing field-report media is copied into the private archive and verified before its database report is removed. Original media files are retained. Workbook external evidence links are archived as references: the external files are not downloaded or deleted. This job does not invent a new official report; existing findings, actions and any case_field_reports are included. Cases with unmapped/range hyperlink references in their source sheet are conservatively skipped.

Uploaded files are downloaded again and checked for byte length and SHA-256. Only then does a backend-only function lock the relevant tables, compare the current database snapshot to the archived checksum, recheck closure eligibility and delete the archived cases, notes, links and optional field reports in one transaction. A failed upload, verification, changed case, or unexpected foreign-key dependency stops deletion. Completed runs keep small audit receipts. Pending runs retry the same immutable file paths. If source values change during a pending run, the job stops for administrator review; do not delete pending manifests or uploaded archives casually.

## 1. Install the SQL

Open `supabase/migrations/20261103_ten_day_archive.sql`. Copy all SQL into Supabase SQL Editor. Save query as **Create Ten Day Case Archive**, then Run once. This creates helpers and the private `case-archives` bucket. It does not start archiving or delete cases.

The earlier loading-performance SQL is independent; archiving is not a substitute for query optimization.

## 2. Configure backend credentials locally

Copy `.env.archive.example` to `.env.archive.local` in the project root. Set `ARCHIVE_SERVICE_ROLE_KEY` to the project's backend service-role key from Supabase Settings → API Keys. Keep this file private. Do not use any `VITE_` variable, send the key in chat, put it in the browser, or commit it. `.env.*.local` is already ignored by git.

The publishable key cannot run this job. No service-role credential has been added by the coding agent.

## 3. Preview, then run once

From the project root terminal (Node 22 is already installed):

```powershell
node --env-file=.env.archive.local scripts/archive/run.mjs
```

This only prints candidate count/cutoff; no file uploads or deletions. Candidate preview may include cases later skipped because of unmapped hyperlinks. Check it before the initial bulk archive.

Run the authorized archive and deletion:

```powershell
node --env-file=.env.archive.local scripts/archive/run.mjs --commit
```

Keep the terminal open. On errors the job stops; previously completed batches remain archived, while the failed batch's records remain in the database. Retry uses verified immutable archives. No shared passwords are requested or embedded.

## 4. Daily scheduling

After the initial run is verified, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/archive/install-daily-task.ps1
```

Task name: **Mohafiz - Archive Closed Cases After 10 Days**. It runs daily at **03:00 in this computer's local timezone**, with missed-start catch-up. The computer must be powered on and this Windows user logged in. This local schedule is not a hosted 24/7 service. A cloud worker with the same script is needed if the job must run while this PC is off. The script never places the service-role key in task arguments.

Check Task Scheduler → task → Last Run Result and History. A nonzero result needs review. The setup has not registered or run a live task automatically.

## 5. Retrieve archives and verify

Supabase Storage → private **case-archives** bucket → `closed-cases/<run>/`. Download `cases.xml`, `snapshot.json`, and `manifest.json` (and media subfolder if present). Open `cases.xml` in Excel and optionally Save As `.xlsx`; retain the original JSON and manifest for exact recovery. Files are per batch rather than a single workbook that is repeatedly overwritten.

SQL Editor query name: **Check Ten Day Archive Runs**

```sql
select id, created_at, completed_at, state, case_count, object_prefix
from public.case_archive_runs
order by created_at desc;
```

Normal case screens show remaining active/recent database rows, not archived ones. The earlier 30,609-row import checksum queries will no longer match after authorized deletion. Do not reimport missing archived rows merely to make those original counts match. No archive-browsing UI has been implemented yet; retrieve through the private Storage dashboard.

Small import-batch metadata, repair backups, auth users and archive receipts are retained. Deleting rows makes database space reusable; it does not guarantee an immediate drop in allocated database size. Archived files still consume Storage quota. No spreadsheet-only deletion can mean literally zero storage use.

## Validation and remaining live checks

Local archive helper tests cover safe spreadsheet cells, long Unicode findings, failed downloads, corrupt readback and retry verification. Production SQL, live Storage uploads, restore from the snapshot and first deletion still require verification in the actual Supabase project. No cases have been archived/deleted by the coding agent.
