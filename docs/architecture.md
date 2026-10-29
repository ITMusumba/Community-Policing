# Community Policing — initial architecture

## Application shape

- Next.js App Router, React, TypeScript and Tailwind CSS for the mobile-first interface.
- Convex for application data and backend functions.
- Capacitor for native Android packaging.
- Vercel is the proposed web deployment target; production deployment is not configured yet.

## Build sequence

1. Inventory PoliceWatch screens, flows, Firebase collections, authentication, and any existing integrations.
2. Agree the user roles and permission matrix before implementing data access.
3. Define Convex schema and server-side authorization for each read/write operation.
4. Migrate incident reporting, status history, complaints, notices, and messaging incrementally.
5. Add file/attachment policy, abuse prevention, audit trails, retention rules, and account recovery.
6. Add automated checks and test browser and Android behavior separately.
7. Configure deployment and Android signing only after the app passes the security and functional checks.

## Security requirements

- Do not expose private incident details or complainant identity to unauthorized users.
- Never rely on hidden UI controls as authorization; enforce permissions in backend functions.
- Do not add demo authentication bypasses or seed real-looking incidents in production.
- Validate and rate-limit user-submitted content and uploads.
- Keep secrets and signing material out of Git.
- Define who can view, assign, update, export, and delete reports, and record sensitive administrative actions.

## Current status

The repository contains a starter interface and configuration only. Convex is listed as a dependency but no Convex deployment, schema, authentication provider, or report persistence has been configured. Capacitor identity is defined; native Android project generation and build validation remain outstanding.
