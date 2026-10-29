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

The new repository now contains:
- A mobile-first Community Policing starter UI.
- A Convex schema including Convex Auth tables and application data tables.
- Convex Auth configuration with password sign-in/sign-up.
- Citizen sign-in UI and first-login citizen profile creation.
- Server-side identity, officer, and administrator guards.
- Initial report and complaint mutations/queries and notice-board queries.
- Participant-checked message operations.
- A Capacitor configuration and static-export settings.
- Setup notes for Convex deployment and trusted first-administrator provisioning.

Still not configured or verified:
- A live Convex deployment, generated Convex files, and environment variables.
- First administrator bootstrap and end-to-end authentication tests.
- Frontend integration for reports, complaints, notices and messaging beyond authentication.
- Attachment/storage access policy, retention procedures, and session-storage review for Capacitor.
- Vercel deployment and Android build.
- Automated build, typecheck, and lint results.

**Do not use production or real complainant data until authentication, access rules, and storage policies have been configured and tested.**
