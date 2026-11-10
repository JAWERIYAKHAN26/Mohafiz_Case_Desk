# Latest workbook import and Excel calculations

Implementation is prepared and locally tested. **It has not been applied to live Supabase.** The available service-role API credentials cannot execute SQL migrations. Use the project's Supabase SQL Editor; do not share service-role keys or database passwords in chat.

## Apply the prepared files

These private files are under ignored `outputs/current-workbook-audit/`. They contain case information and must not be committed or published.

1. The full `IMPORT_LATEST_WORKBOOK.sql` exceeds the SQL Editor's accepted query size. Run `python scripts/workbook/split_delta.py`, then use the folder named in `sql-editor-parts.json`: run its eight `UPLOAD_01_OF_08.sql` through `UPLOAD_08_OF_08.sql` files, followed by `APPLY_STAGED_IMPORT.sql`. Uploads only stage text in a private table; they do not change cases. The final file requires all parts and the exact payload checksum before applying the original import in a single transaction. This imports the audited 6 November workbook revision into the existing application's dataset lineage. It does not create a second copy of the old workbook. Table locks, per-record before-value guards and revision journal protect against partial imports and repeat-run duplication. Source IDs remain unchanged. New rows record the new workbook checksum and worksheet in their provenance metadata. The original full SQL remains suitable for a direct database connection.
2. Run `INSTALL_WORKBOOK_BACKEND.sql` if not already installed. The user's SQL Editor run and subsequent API checks confirmed the intake, assignment and case-list functions are now available. There is no need to reinstall it to fix the oversized import. This bundle installs `20261106_workbook_calculations.sql`, preserves imported cases and workflow history, checks prerequisites and is tested for repeat execution.
3. Run `VERIFY_AFTER_IMPORT.sql`, then refresh the app and sign in again. Do not treat local tests as live acceptance. Check a client intake, saved ID, CRO acknowledgement, city officer assignment, FSO report, evidence upload, recovery and closure using approved test cases.

If a file reports a collision or missing prerequisite, its transaction rolls back. Review the error; do not truncate tables or reimport everything. Concurrent edits made since the audit are recorded as conflicts rather than overwritten.

## Expected results for the audited database

| Change | Expected |
|---|---:|
| New cases | 79 |
| Existing case updates applied | 220 |
| Existing case updates deferred due to app activity | 2 |
| Missing notes inserted | 153 |
| Changed notes updated | 24 |
| Changed notes deferred | 1 |
| New evidence hyperlinks | 10 |

Imported worksheet totals should become 30,688 cases, 61,539 notes and 2,026 hyperlinks. Portal Intake records, if any are created later, are separate. Additional concurrent edits may increase the conflict count.

Review journal records with `state='conflict'`. In the audited state, source rows 30605 and 30609 already have acknowledgements in the app. Row 30605 is Closed in the latest workbook. These require an explicit decision to keep the operational state or reconcile it to the workbook; neither acknowledgement history nor Excel changes are silently discarded. The journal retains proposed updates.

## Excel behaviour implemented

- DATA!D2:G40's 39 exact issue/SLA/priority rules and 119 city/region mappings.
- Reporting date display and reporting delay, total loss, remaining recovery, days pending, negative SLA overrun, case duration, days since closure and date/status warnings.
- Priority, SLA inputs, FSO/max scores including P3DR, Sunday-based WEEKNUM, yesterday/old categories.
- Read-time calculations use Pakistan's date, so daily values advance without updating every stored row or running cron. Manual source values are preserved when the corresponding cell did not have a formula. Historical broken/error or explicit cross-row formulas retain their cached values for review. This is standard case-row formula parity, not an Excel calculation engine for every chart or auxiliary worksheet.
- Lists, detail, reports, CSV export and dashboard totals use effective values. Paged lists calculate visible rows rather than recalculating the full workbook on every request.
- New intake uses workbook issue categories and automatic priority. Company/personal loss are separate; optional customer/contact/CNIC/coordinates/consignment values are saved as text. Identifiers and phone leading zeroes are preserved.
- New Case IDs retain COMPANY-CITY-MON-YY-N format. An advisory lock and request UUID make allocation and retries safe; suffixes continue from the highest existing number. Historical IDs and existing source duplicates are immutable. This deliberately avoids Excel's row-shift/COUNTIFS defects and does not renumber records when sorted or deleted. Excel and the portal must not independently allocate new production IDs for the same scope.

The original workbook is backed up as `source-backup-ef71ffe43790.xlsx` with its checksum verified. External evidence files are not copied by importing hyperlinks. Macros, formatting and auxiliary Excel dashboards are not reproduced by these case-table calculations.

## Local validation and regeneration

```powershell
python scripts/workbook/build_delta.py
python scripts/workbook/split_delta.py
python scripts/workbook/build_setup.py
node scripts/admin/validate-desk-workspace.mjs --bundle
node scripts/workbook/test_delta.mjs
node scripts/workbook/test_delta.mjs --staged
npx tsx --test src/data.test.ts src/workbookData.test.ts src/liveOperations.test.ts src/caseReport.test.ts
npm run build
```

The builders use the frozen audit snapshots and workbook revision in `outputs/current-workbook-audit/`; regenerate the read-only audit before applying a later workbook. `test_delta.mjs` tests actual import SQL in isolated PostgreSQL, including a second execution, live-edit conflicts and operational-history preservation. The backend suite checks roles, assignment, closure, formula values, intake data, stable IDs and retry deduplication. Optional isolated test dependency: `npm install --prefix outputs/desk-sql-validation --no-save --package-lock=false @electric-sql/pglite`.
