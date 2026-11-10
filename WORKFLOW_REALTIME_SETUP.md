# Connect live workflow counters and group text chat

## Apply backend setup

Open `supabase/migrations/20261103_workflow_realtime_chat.sql`, copy all contents into Supabase SQL Editor, save as **Connect Workflow And Realtime Chat**, and run once. Requires the workbook read access and scoped dashboard timeout fixes already applied. No sheet values or original assignments are updated. This creates separate workflow/event tables, group messages/read cursors, role policies, action RPCs and Realtime publication entries.

The coding agent has not applied this migration remotely. Missing-table/function errors until it is applied are expected; do not disable RLS or paste a service key into frontend configuration.

## What works after setup

- To acknowledge counts imported Pending cases that have not entered the operational workflow.
- CRO/CRO Manager opens a non-closed case and acknowledges it. The existing sheet assignee stays unchanged.
- A matching assigned FSO opens the same case, starts dispatch, confirms arrival, then submits text findings (20–10,000 characters).
- CRO/CRO Manager or covered SOM/SFSO can mark submitted findings reviewed. Every operation appends actor/time/body history.
- In progress counts operational cases whose dispatch has started. Reviewed findings do not automatically close the case.
- Updates to review is unread group messages plus submitted findings awaiting review. Clicking opens both categories.
- Live state changes refresh counters; a 30-second counter retry runs while the page is visible.
- Existing city/company group navigation opens saved text chat. Open the same allowed group in two independent browser sessions to test realtime delivery. Status says Live only after WebSocket subscription succeeds. A visible-page 15-second fetch provides reconnect recovery.
- Message history is paginated, displays PKT timestamps, preserves multiline text and deduplicates realtime delivery/insert-response retries. Send failures retain the draft. The database assigns sender identity, role and time; the browser cannot spoof them.
- Opening a visible group marks messages through the newest displayed message as read, reducing the unread count.

## Access

City groups: CRO/CRO Manager have the original three desk groups. FSO/SFSO/SOM have their matching city; Rawalpindi shares Islamabad. Client has no city-group access. Company groups: CRO/CRO Manager/SFSO/SOM have PostEx/Daraz/Buscaro; Client has its exact company; FSO has no company groups. These group channels are shared conversations among their members, separate from case read coverage; do not post information intended only for a private case discussion into a general group.

All case actions additionally validate trusted role and original company/city/officer coverage on the server. Mutations serialize on the source case row and reject invalid stage transitions. Closed imported cases cannot enter dispatch. Unknown accounts cannot read or write groups.

Sara Ahmed still needs a matching original assignment to perform case actions; this integration does not fabricate or reassign imported cases. Newly assigning FSOs, closure/reopening, case-private conversations and chat photos/videos/voice remain separate work. Text findings are integrated here; the earlier media field-report storage is a distinct feature.

## Verify

Run `supabase/TEST_REALTIME_CHAT_PERMISSIONS.sql` as **Test Realtime Chat Permissions**. It checks server sender identity, allowed company access and forbidden cross-group inserts; all test messages roll back. Then use two real accounts to exchange a short test message in a shared group and reload to confirm persistence.

Local frontend build and message merge/retry tests are checked separately. Live database execution, RLS tests and realtime delivery cannot be claimed before this migration is applied.

## Retention interaction

Workflow tables reference source cases without cascading deletes. The previously prepared archive worker does not yet serialize these new operational events. A source case with workflow records will therefore block deletion rather than silently lose its history. Extend archive payload and restore validation before enabling archive deletion for workflow cases. Existing imported Closed cases do not receive workflow records from this migration. Group chats/read cursors are not case records and are not deleted by the 10-day case archive.
