# Real data and demo comparison

The earlier real-data implementation replaced the existing workspace with a separate read-only viewer. That caused navigation, dashboard content, Case Board behavior and operational actions to differ. This file records the remaining differences rather than treating a successful database import as complete workflow integration.

## UI corrected

- Case Board uses city columns and clickable case cards again; My Cases and Reports retain tables.
- Dashboard no longer displays the case table beneath its KPIs.
- Dashboard uses the existing banner, KPI, CRO action desk and activity panel structure.
- Dashboard KPI navigation includes the existing white Back to Dashboard button; sidebar navigation does not add it.
- Reports export/reset controls sit in the banner, outside the filter row.
- Company/hub stays plain text; table priority/status are colored text without pill backgrounds. Exact locations retain underline on hover.
- Profile and header remain visible on mobile, including when the legacy FSO classes are present.

## Deliberate source preservation

The workbook has Closed, Pending and one missing status. It does not establish acknowledgement, queue, dispatch or unread-message state. Total/Pending/Closed are real workbook counts; generating five original workflow KPI counts from those three statuses would invent information.

Case Board shows city groups for the current 50-row server page. Its count labels explicitly say “on this page”; pagination and filters remain available. It does not pretend to contain every matching card at once.

## Functionality still requiring backend integration

- Acknowledge / forward to SFSO; CRO fallback dispatch when SFSO unavailable.
- FSO assignment, availability and workload; SOM/SFSO operational views.
- Arrival, field findings, progress, reassignment, classification and closure.
- Client/city/case conversations, unread state and notifications.
- Audit activity and manager audit screen.
- New case creation for permitted roles.
- Full filtered export and official case report generation (current export is explicitly current page).

Existing demo implementations of these actions remain separate. They must not be presented as saved production actions. Production writes need an operational store keyed by source SHA, sheet and row, trusted role/coverage checks and audit records. The verified workbook import is retained as source evidence rather than overwritten.

The next backend phase must implement those operations and connect the existing controls to it before claiming functional parity. The database summary error shown earlier also needs its actual error code checked after the improved error display reloads.
