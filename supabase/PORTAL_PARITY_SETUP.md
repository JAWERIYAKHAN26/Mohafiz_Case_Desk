# Enable the live demo interactions

Run [20261104_portal_parity.sql](migrations/20261104_portal_parity.sql) once in the Supabase SQL Editor, after the existing workflow/realtime migration. Then reload the app. Running only `REFRESH_API_SCHEMA_CACHE.sql` does not create these functions.

The migration adds:

- Server-generated case IDs in `CLIENT-CITY-MONTH-YEAR-COUNTER` format. ID allocation is serialized across simultaneous submissions; a retried request returns its existing ID.
- Case intake for Client accounts only, with server-side coverage and input checks.
- Navigation activity saved per user, merged with permitted workflow events for Recent Activity.
- Unread counts per chat group, used for sidebar badges and the Updates card's direct city-chat navigation.
- City and client acknowledgement messages, saved in the same transaction as the acknowledgement.
- Realtime subscriptions for newly created cases.

Original Excel rows and IDs are not changed. New cases are explicitly stored under the `Portal Intake` sheet with portal origin metadata; they use the current dataset so existing summary, filters, workflow, role policies and reports can read them. Case creation writes only through the restricted RPC. It does not grant browser clients direct INSERT access to the imported table.

## Check after applying

1. Sign in as CRO. Open New Cases: search/company/city/priority controls should appear inside the table header, with an Acknowledge action per row.
2. Open a location from New Cases or the Case Board: the incident modal shows the source address, rider, officer, stage, and recorded coordinates. Missing GPS remains labelled as missing; no verification claim or invented coordinates are shown.
3. Open Pending cases: the city board retains its columns and Pending filter; the search icon stays inside the input.
4. Send a city-chat message from another authorized account. The CRO badge and Updates count refresh; Updates opens the first unread city chat, or Islamabad when none is unread. Reading the chat clears its badge.
5. Navigate to another page and back to Dashboard. Recent Activity should include the page visit, with Pakistan time.
6. Sign in as Client and raise a legitimate new case using + Raise a Case on My Cases. On successful submission the generated ID appears in the confirmation and the case appears in New Cases. Existing IDs remain unchanged.
7. Acknowledge a case: it leaves New Cases and creates a workflow event and notifications in the supported city/client chats. Assignment and later field actions still follow the existing live workflow's permissions.

The migration has been prepared locally; applying it requires SQL Editor or a database connection with schema privileges. The existing service-role REST credential can read cases but cannot install SQL functions.

If you already applied an earlier portal parity migration, run [20261104_portal_parity_client_only.sql](migrations/20261104_portal_parity_client_only.sql) to restrict the existing creation function to Clients. CRO and CRO Manager cannot create cases through the API.

## Repair dashboard and report timeouts (57014)

After the current workspace and calculation migrations are installed, run
[20261110_workflow_query_performance.sql](migrations/20261110_workflow_query_performance.sql)
in the Supabase SQL Editor, then reload the app. The script is transactional and can be rerun.
It changes no cases, assignments, passwords, or historical events.

The repair replaces correlated workflow/event read policies with a permitted-case key set
computed from trusted JWT metadata. It preserves company/city coverage, Islamabad's Rawalpindi
supervision, and effective FSO assignments (including revocation from former assignees).
Dashboard/list functions cache identity expressions and workflow counters calculate unread messages
once. Supporting city/company/closure indexes are included. Existing pagination and workbook
calculations remain intact; the statement timeout is not increased.

The SQL Editor must use a schema administrator. REST service-role credentials cannot install
this migration. Running only REFRESH_API_SCHEMA_CACHE.sql will not apply the repair.

Validation: `node scripts/admin/validate-desk-workspace.mjs` runs an isolated PostgreSQL/WASM
instance, including 30,000 additional cases and all four dashboard/list RPCs as CRO, Client,
FSO and SFSO. These local timings do not predict production latency. After deployment, verify
CRO Reports and Ali Raza's totals, filters and assignments using real Sign in. Check that a
reassigned case disappears from the previous FSO and appears for the new FSO.

## Field rejection, notes, hubs and richer chat

Run [20261111_field_chat_updates.sql](migrations/20261111_field_chat_updates.sql) after the
performance repair above, then reload the app. The full installation bundle also includes it.
The migration is transactional and rerunnable. Applying it needs SQL Editor schema privileges.

- Notes accept any non-empty text up to 10,000 characters. Previously the button silently
  required ten characters; the aligned form now explains when saving is available.
- City hubs come from existing records visible to the signed-in client. A single known hub
  is selected automatically; multiple hubs appear in a dropdown. Changing city clears the
  previous hub. Other/new hubs can still be entered without inventing a default.
- Only the assigned FSO can reject an Acknowledged/In progress assignment, with a reason
  of 10?2,000 characters. The case remains open/Acknowledged for supervisor reassignment.
  An empty operational assignment explicitly overrides the imported officer, revoking access
  from the rejecting officer without modifying the source workbook row.
- Rejection and dispatch acceptance emit internal city-group messages in the same transaction
  as the workflow event. Rawalpindi uses the Islamabad group.
- Chat searches persisted messages by words/Case ID (up to the 100 newest matches), supports
  six attachments of up to 25 MB each, and records voice drafts for up to three minutes.
  Audio playback uses expiring signed URLs; the attachment bucket is private and group scoped.
- Only FSOs in internal city chats can share live GPS. Sharing ends after 15 minutes, on Stop,
  or when leaving the chat. The last shared point remains in message history; GPS updates
  require browser permission and an open chat. Other roles cannot publish GPS through the RPC.
- Internal group calls use WebRTC audio inside the app. Prepare and send the call invitation,
  then participants select Join group call. Calls support mute/unmute and leave; audio is not
  recorded by the call feature. Private Supabase broadcast/presence policies authorize city
  staff and deny clients and other-city accounts. Existing unrelated Realtime policies should
  be reviewed if the project grants broader access independently.

Microphone and GPS require HTTPS (localhost is allowed). WebRTC uses STUN by default.
For reliable calling across restrictive/mobile networks, configure your TURN service using
`VITE_RTC_ICE_SERVERS` as documented in `.env.example`, then restart Vite/rebuild. Browser ICE
credentials must be short-lived; never put a TURN provider admin secret in a Vite variable.
No TURN credentials or live deployment connection are configured by this change.

Validation:

```powershell
node scripts/admin/validate-desk-workspace.mjs
python scripts/workbook/build_setup.py
node scripts/admin/validate-desk-workspace.mjs --bundle
```

Browser regression checks (mock database and signaling, actual browser media/WebRTC APIs):

```powershell
npm install --prefix outputs/ui-validation --no-save --package-lock=false @playwright/test
npm run dev -- --port 5188
# In another terminal, with Chrome installed:
node scripts/admin/validate-chat-ui.mjs
```

The checks cover note saving, rejection reasons, hub changes, chat search, voice recording
and playback controls, FSO-only GPS, mobile layout, and a two-browser WebRTC connection.
Screenshots go to `outputs/ui-validation`. Live multi-device Supabase calling, TURN traversal,
and physical GPS accuracy still require deployment/device verification.
