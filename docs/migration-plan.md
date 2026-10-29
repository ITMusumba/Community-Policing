# PoliceWatch → Community Policing migration

## Existing modules identified

- Officer authentication and profile lookup by badge number
- Incident monitoring dashboard and notice board
- Report details, status changes, priority actions, assignment, bulk management
- Formal complaints list and complaint conversations
- Officer-to-citizen chat
- Officer report module (to be verified against the full source)
- Bottom navigation and responsive shell

## Existing Firebase dependencies to replace

The old application uses Firebase Authentication, Firestore, and Storage. Its visible data model includes `postsreports`, `complaints`, `officers`, `users`, and `badgeIndex`. The old code also contains local demo data and UI handlers that only update React state or log actions.

## Migration phases

1. **Foundation — started:** Next.js + TypeScript, Convex schema, server-side role checks, environment examples.
2. **Authentication — initial source committed:** Convex Auth password provider, client provider, sign-in/sign-up UI, citizen profile provisioning and administrator-only officer provisioning. Convex deployment and generated code still need to be configured and tested.
3. **Reports — initial backend added:** create/list reports, status history, officer feed, status updates, audit logs. Assignment and attachments remain to be implemented.
4. **Complaints — initial backend added:** create, citizen-owned list, officer feed, status updates, and officer assignment. Messaging for complaints remains to be implemented.
5. **Notice board — initial backend added:** public-only and officer-only feeds, plus officer-created notices.
6. **Messaging — initial backend added:** report-linked conversations, participant-checked message reads/writes. Attachment handling, read receipts, complaint-linked chat and broader abuse controls remain pending.
7. **Officer reports — pending:** drafts, submissions, evidence attachments, and audit history.
8. **Android and deployment — pending:** validate Next.js static export compatibility, configure Capacitor native project, test camera/location/network/session behavior, then deploy.

## Known hazards in the old code

- A login handler changes the screen to the dashboard without checking successful authentication.
- Demo incidents and named demo complaints/messages are hard-coded.
- Report status and assignment handlers only update local state or log to the console.
- An old officer creation helper writes the password into a Firestore document. Never migrate this behavior or any plaintext passwords.
- A badge lookup pattern that exposes officer emails must be replaced with a safe authentication flow.
- Build lint/type checks should remain enabled.

## Current implementation status

- **Steps 1–3 implemented in source:** anonymous-report schema and tracking, media storage references, report status history, nearest-station demo routing, and a manual 10-station Kampala/Kamuli seed.
- **Step 4 implemented in source:** live district-scoped officer feed, area/category/status filters, audited quick actions, and anonymous replies; citizen quick-report, IndexedDB queue, GPS, camera/video, voice note, and tracking UI are added.
- **Super-admin user management:** protected user listing, role changes, account disable/enable, and audit logs are implemented; password-reset email remains stubbed until a verified email provider is configured.
- **Not yet verified:** Convex deployment/schema push, station seeding, first super-admin bootstrap, production media/face-blurring policy, offline upload retry edge cases, and end-to-end behavior.
- Run `npm install`, configure `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_SITE_URL`, then `npx convex dev` and `npm run dev`; run `npm run typecheck` and `npm run lint` once before calling this demo ready.

**Do not use production or real complainant data until authentication, access rules, and storage policies have been configured and tested.**
