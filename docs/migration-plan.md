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
2. **Identity — pending:** select and configure an authentication provider; provision citizens/officers/admins through a trusted process; remove demo login and client-controlled roles.
3. **Reports — initial backend added:** create/list reports, status history, officer feed, status updates, audit logs. Assignment and attachments remain to be implemented.
4. **Complaints — initial backend added:** create, citizen-owned list, officer feed, status updates, and officer assignment. Messaging remains to be implemented.
5. **Notice board — initial backend added:** public-only and officer-only feeds, plus officer-created notices.
6. **Messaging and attachments — pending:** participant-only reads/writes, file validation, private storage URLs, abuse controls, read receipts.
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
- A Convex schema for profiles, reports, report history, complaints, notices, conversations, messages, officer reports, and audit logs.
- Server-side identity, officer, and administrator guards.
- Initial report and complaint mutations/queries and notice-board queries.
- A Capacitor configuration and static-export settings.

Still not configured or verified:
- Authentication provider and trusted officer/admin provisioning.
- Convex deployment and generated Convex client/server files.
- End-to-end frontend integration with reports, complaints, notices, and messaging.
- Attachment/storage access policy and retention procedures.
- Vercel deployment and Android build.

**Do not use production or real complainant data until authentication, access rules, and storage policies have been configured and tested.**
