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

1. **Foundation:** Next.js + TypeScript, Convex schema, server-side role checks, environment examples.
2. **Identity:** select and configure an authentication provider; provision citizens/officers/admins through a trusted process; remove demo login and client-controlled roles.
3. **Reports:** create/list reports, status history, assignment, audit logs, safe pagination.
4. **Complaints:** list, assign, status history, and access-controlled conversation.
5. **Notice board:** public-safe notice feed with moderation and publication controls.
6. **Messaging and attachments:** participant-only reads/writes, file validation, private storage URLs, abuse controls, read receipts.
7. **Officer reports:** drafts, submissions, evidence attachments, and audit history.
8. **Android and deployment:** validate Next.js static export compatibility, configure Capacitor native project, test camera/location/network/session behavior, then deploy.

## Known hazards in the old code

- A login handler changes the screen to the dashboard without checking successful authentication.
- Demo incidents and named demo complaints/messages are hard-coded.
- Report status and assignment handlers only update local state or log to the console.
- An old officer creation helper writes the password into a Firestore document. Never migrate this behavior or any plaintext passwords.
- A badge lookup pattern that exposes officer emails must be replaced with a safe authentication flow.
- Build lint/type checks should remain enabled.

## Status

The new repository has a starter UI and a first Convex schema/report workflow. No authentication provider, deployed Convex backend, storage policy, Vercel project, or Android build has been configured or verified yet.
