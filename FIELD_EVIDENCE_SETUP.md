# Field findings: photos, videos and voice notes

The FSO demo supports local attachment previews, recording/playback and report submission. Demo files remain in browser memory, disappear on refresh and are never uploaded using a different signed-in user's Supabase session.

Limits: six attachments per report, 25 MB per attachment, two minutes per recorded voice note, and at least 20 characters of report text. Uploaded videos are size-limited; no duration limit or transcoding is applied. Recording needs microphone permission and HTTPS or localhost. If the browser cannot record, attach an audio file instead. HEIC/HEIF preview depends on browser support.

For real Supabase evidence, run `supabase/migrations/20261103_field_evidence.sql` in SQL Editor. Save the query as **Create Field Evidence Storage**. This creates the private `field-evidence` bucket, append-only `case_field_reports` records and access policies. No anonymous evidence access is granted. Object paths are canonical; preview URLs expire after one hour.

Live submission is deliberately unavailable until a case is loaded from the database with a verified `sourceRecord` (workbook checksum, worksheet and row). Current demo data has no such mapping. Do not manufacture that reference from the display Case ID: duplicate Case IDs exist. Real FSO metadata must match the sheet's assigned officer and city exactly; role/roster mapping is still required. SQL migration has been prepared locally and not executed against Supabase.

Files upload first. The report record is inserted only after every upload succeeds. A failed save keeps the draft and selected files in the current form and attempts to clean up unlinked uploads. The UI must not claim a report was saved when only local demo state exists. Navigating away from an unsent form or refreshing still clears its in-memory draft.

Before enabling real uploads, test two actual FSO accounts: each must be unable to submit to the other's case or read its evidence, while authorized CRO/supervisors must be able to read case evidence. Verify upload failure, microphone denial, mobile playback, expired preview links, duplicate submission and browser refresh recovery. Full live case integration and end-to-end verification remain outstanding.
