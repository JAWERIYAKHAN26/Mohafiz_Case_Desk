# Mohafiz Case Desk workflow

The screens follow `prototype-reference.html`, the supplied Mohafiz Case Desk Prototype. The application retains React 19, TypeScript, Vite and CSS. The previous screen implementation is preserved in `src/legacy-main.tsx.bak`; its data module and contract tests remain available.

## Sign in

The IMS reference login uses a dark grid introduction panel alongside a light Secure access card, with email, password visibility toggle and teal Sign in securely button. It stacks vertically on mobile. The demo role selector and password reset notice remain available.

Use any valid email and nonempty password in this browser demo. Use the single sign-in dropdown to choose CRO, SFSO, FSO, Client PostEx, Client Daraz or Client Buscaro. Each client option sets its company automatically; there is no separate company selector. Sign out and choose another role to follow a case through the workflow; records remain available until refresh.

## End-to-end flow

1. A client opens Raise a Case, enters issue, city, address, amount, priority and a description of at least 20 characters. CRO can also use New Cases > Log a case with company and source channel. Submission creates a New case with a unique reference.
2. CRO starts on Today. Counts and recent activity reflect the session. New Cases supports company, city and priority filters. Acknowledge only moves a case to Acknowledged. Acknowledge & send to SFSO moves it to Escalated with a proposed officer.
3. SFSO opens Escalations, selects an officer and confirms assignment. The case moves to In progress. Field Team shows current active and held workloads.
4. FSO sees only Ali Raza's assigned cases in the mobile-style My Cases screen. Accept case starts simulated tracking. Confirm arrival becomes available after acceptance. Send report becomes available after arrival and requires at least 20 characters. Photos and voice notes retain file names only. Staff can inspect the report in case details.
5. Client Updates is the shared case conversation for client, CRO and SFSO. Internal Case Group / Case Group is separate and staff only. Select a case, send text or attach a document, image, video or file. Internal conversations are absent from client navigation.
6. CRO opens Classification after reviewing field findings. The IMS-style Classify Incidents table shows case/detail link, date, victim/accused, incident description, region/branch, amount, current TAT, classification, initial remarks and Submit. Select Genuine, Negligence or Fraud and submit each row to save classification and remarks together. Reports reflect the saved classification; case details retain the remarks. Track Incidents opens Case Board. Missing victim and TAT data display Not recorded / Not set; branch falls back to the company. New cases remain in intake until acknowledged.
7. Case Board displays New, Acknowledged, Escalated, In progress, Hold and Closed. Open any card for details. CRO and SFSO can change the stage, escalate an acknowledged case, place work on hold, resume or close it, and record recovery up to the case amount.
8. Clients see only their company's My Cases, Raise a Case, Client Updates and Reports. Field officers cannot see client conversations or unassigned cases.
9. Reports filters company (staff only), city, date range, status, classification and case ID. Totals and Export CSV use exactly the filtered rows. Reset clears filters. Formula-like CSV values are escaped.
10. CRO Audit Logs shows session sign-ins, navigation, case changes, messages and exports. Entries have no edit or removal control.

## Theme and limitations

The IMS screenshot theme is implemented in `src/theme-desk.css`: permanent navy sidebar (#111827), blue active navigation (#1677C8), neutral light workspace (#F5F6FA), white cards, dark navy title banners and teal primary actions (#087F8C). Navigation uses compact icon tiles and the top bar shows the signed-in user and role. Light mode is the default for a new browser; an explicitly saved dark preference is respected. The top-bar moon/sun button switches light/dark appearance without clearing fields and saves the choice locally. All role dashboards, login, forms, conversations, reports and the six-column board share the theme. Navigation and forms adapt to narrow screens; wide tables and the board scroll horizontally.

Authentication, password reset, GPS, messages, audit records and attachment handling are browser simulations. Cases and conversations reset on refresh. Theme choice persists. Demo case dates are fixed to 28 October 2026. A real backend and server-side authorization are not connected.
