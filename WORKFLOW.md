# Working with a case in Mohafiz

## Daily staff flow

1. Sign in with a sample account. Password: `demo`.
2. Select All clients or one company in the top bar. The selection follows you across pages and scopes counts, search results and CSV reports.
3. Start on Dashboard. Click a count to open the matching incidents.
4. Open Classify Incidents. Choose the classification and enter initial remarks (at least 10 characters). Saving changes a pending case to In progress and removes it from the classification queue.
5. Open Follow-Ups / Findings. Search for the same case ID. Record verification facts, findings and recommendations. Reports need at least 20 characters. Follow-up drafts save automatically on this device.
6. Use Counterpart Help if another city or team needs to assist. The request stays Pending and generates a sample notification.
7. Open Submit Investigation when the work is complete. Record recovery and FIR details. If FIR registered is Yes, the FIR number, date and police station are mandatory. The report needs at least 30 characters. A confirmed save closes the case.
8. Review the case under Track Incidents > Closed, or use Reports to filter and export it. PostEx cases have a Copy for PostEx IMS box.

The prototype begins with existing sample cases; there is no new incident intake form. Current TAT is the case deadline. Overdue indicates an open case past that date. The demo clock is fixed at 28 October 2026.

## Supporting pages

- Incident detail: summary, exposure, external reference, evidence, timeline, history and reports in one place. Open it from a case ID or Open button.
- Notifications: open a message to see the linked case and mark the message read.
- Blacklist: separate client-specific candidate records. Staff can request removal; managers approve it.
- My Profile: editable staff details and a link to read-only Clients settings.
- Reports: apply filters first, then Export CSV. The file contains the displayed matching records.

## Roles

| Role | Access |
| --- | --- |
| Security officer | All clients; classification, follow-ups, investigations and help requests. Cannot add management instructions or approve blacklist removal. |
| Manager | Staff operations, management instructions and blacklist approval. |
| Client viewer | Own company only; Dashboard, Track Incidents, case details and Reports. |

## Theme

Dark mode is the default. The top-bar sun/moon button changes between light and dark mode without clearing typed fields. The choice persists on this browser. Base brand colours are in `src/style.css`; readable type sizes, status colours and shared refinements are in `src/theme.css`.

## Code flow

`src/main.tsx` contains the screens and form state. Each screen calls `src/data.ts`, where sample records, client settings, validation and permission checks live. Successful writes trigger refreshed counts and lists. Data errors leave form text intact.

This is a browser prototype: authentication, attachments and notifications are simulated. Cases and saved changes reset on refresh; follow-up drafts and theme persist locally. Production storage and server-side authorization are not connected.
