# Mohafiz Incident Workspace

React + TypeScript + Vite prototype with fictional data only.

Run `npm install`, then `npm run dev`. Build with `npm run build`. Data contract tests: `npm test`.

Sample login: officer@mohafiz.demo / demo. Other sample accounts appear on the sign-in screen. Use the labelled Prototype only controls to change roles or simulate a failed save. Client viewer accounts are restricted in the UI and data module.

All sample records are held in memory and reset on refresh. Follow-up drafts and theme use browser localStorage. Attachments retain sample metadata, not uploaded file contents; candidate photos are temporary browser previews. Notifications and authentication are simulated. No Google Sheets integration or production identity backend is connected. A real deployment must move authorization and storage behind a server.

The single data module is src/data.ts. Client lists, reference labels, branches, classifications and TAT settings are data-driven. All screens use that module. The demo clock is fixed to 28 October 2026 for repeatable overdue counts. Case IDs are immutable through the save contract; sample sequences are per client and month. The requested flows operate on existing sample cases; no new incident reporting flow was specified.

CSV exports include exactly the applied report rows and protect spreadsheet formula cells. The global client scope is always applied first.
