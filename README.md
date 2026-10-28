# Mohafiz Case Desk

React 19 + TypeScript + Vite browser prototype, updated to follow the supplied Mohafiz Case Desk HTML prototype. Reference: `prototype-reference.html`.

Run `npm install`, then `npm run dev`. Build: `npm run build`. Existing legacy data-contract checks: `npm test`.

Sign in with any valid email and nonempty password, selecting CRO, SFSO, FSO or Client. Choose a company for Client. Sign out to switch roles and continue the same in-memory case workflow. See `WORKFLOW.md` for the complete role and screen guide.

`src/main.tsx` implements the revised role-based desk. `src/theme-desk.css` implements the reference theme and responsive layouts. The prior implementation is preserved in `src/legacy-main.tsx.bak`; `src/data.ts`, its tests and the old styles are retained for reference, but are not used by the revised screens.

This is a prototype: authentication, GPS and attachment storage are simulated. Cases, chats and audit history are held in memory until refresh. Only theme preference persists locally. No production backend is connected.
