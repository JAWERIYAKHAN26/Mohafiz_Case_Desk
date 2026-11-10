# Mobile portal role access

The shared portal supports FSO, SFSO and SOM. All three get the compact mobile layout, profile/settings, and their city chat. Demo login offers the existing named officers and supervisor city desks.

| Role | Landing page | Existing controls |
|---|---|---|
| FSO | My Cases | Own assignments, acknowledge, arrival, report/evidence, queue and busy reporting |
| SFSO | Escalations | City-desk case assignment, city case board and officer workload |
| SOM | Case Board | City case monitoring, officer workload and existing supervisor permissions |

Real users sign in with email/password; they cannot pick a role on the login screen. An administrator must create their Supabase Auth accounts and set `app_metadata.role`. Supervisors also require `app_metadata.city` (Islamabad, Lahore or Karachi). FSO accounts require `app_metadata.city` and `app_metadata.officer_name` matching the application officer roster. Do not use editable user metadata for authorization.

Existing `SUPABASE_SETUP.md` describes role assignment. No remote users, memberships or policies were modified by this UI change. The import/evidence database setup and real roster mapping still need completion before live case access works.

Production SFSO coverage is fixed to the city assigned at sign-in. City switching remains available only in development demo mode. Islamabad supervisors retain their existing Islamabad/Rawalpindi coverage.

The new screen design follows the supplied reference: narrow layout, teal officer header, three compact counters, status dropdown, white case cards, red primary actions, separate field-report screen, and floating bottom navigation. FSO has My Cases and City Chat. Supervisors retain their navigation options and menu so assignment/workload tools remain accessible.

The design does not add fake operating-system indicators, participant counts, verified GPS, or background tracking. Existing map/location data is still simulated, and current demo reports remain in memory.
