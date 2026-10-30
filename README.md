# Community Policing

A mobile-first community safety platform for citizens to report incidents, communicate with authorized officers, and follow up on reports.

## Planned stack

- **Web:** Next.js, React, TypeScript
- **Backend and database:** Convex
- **Web deployment:** Vercel
- **Android packaging:** Capacitor and Android Studio

## Rebuild principles

1. Keep the existing `ITMusumba/policewatch` repository intact as a reference and fallback.
2. Migrate deliberately from Firebase to Convex; do not copy Firebase-dependent code without reviewing it.
3. Enforce authorization in backend functions, not only in the UI.
4. Do not seed demo incidents or provide authentication bypasses in production.
5. Treat incident reports, complainant identities, attachments, and officer communications as sensitive data.
6. Test web and Android behavior separately, including permissions, camera, location, offline/network failures, and session handling.

## Initial implementation plan

- [ ] Audit and map reusable screens and workflows from PoliceWatch.
- [ ] Establish the Next.js + TypeScript + Convex project foundation.
- [ ] Define user roles, permissions, and data-retention rules.
- [ ] Implement authentication and secure incident/report workflows.
- [ ] Replace demo-only state updates and messaging with persisted backend operations.
- [ ] Configure Capacitor and validate the Android build.
- [ ] Add deployment, environment-variable, and testing documentation.

## Security note

This repository currently contains the project blueprint only. Never commit credentials, private incident records, production exports, signing keys, or environment files. Because this project handles safety-related reports, consider making the repository private during development. Repository visibility does not replace application-level access controls.

## Status

Working demo deployed on Vercel with a Convex backend. Built so far: anonymous quick report with photo/video/voice and offline retry,
tracking and anonymous follow-up, police district feed with evidence and actions, super-admin user and officer management.
Still to build (see apprules.md): durable offline media queue, all eight languages and audio prompts, map pin, duplicate grouping,
station map, dashboards, Android build, retention rules. See docs/authentication.md for the super-admin bootstrap.
