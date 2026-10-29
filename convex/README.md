# Convex backend setup

## Local setup

1. Install dependencies with `npm install`.
2. Run `npx convex dev` and follow the prompts to create or select a Convex deployment. This generates `convex/_generated` files.
3. Set `NEXT_PUBLIC_CONVEX_URL` in the Next.js `.env.local` file to the deployment's `.convex.cloud` URL.
4. Set the deployment environment variable `CONVEX_SITE_URL` to the matching `.convex.site` URL:
   ```bash
   npx convex env set CONVEX_SITE_URL https://YOUR-DEPLOYMENT.convex.site
   ```
5. Keep `npx convex dev` running and start Next.js in a second terminal with `npm run dev`.

See [the authentication setup guide](../docs/authentication.md) for details and first-administrator provisioning.

## Authentication and roles

- Convex Auth is configured with the password provider.
- The schema includes Convex Auth's required tables.
- New authenticated accounts can only create citizen profiles through the client-accessible first-login mutation.
- Officer provisioning requires an existing administrator.
- The first administrator must be bootstrapped by a trusted project operator, not by a public function.
- The backend's protected functions reject unauthenticated requests.

## Security and deployment notes

Convex Auth is in beta. This project uses the client-side provider; server-side Next.js authentication is not enabled.

The app handles potentially sensitive reports. Before production use, test authorization and session handling, configure recovery and verification policies, review Capacitor session storage, and establish retention, disclosure, deletion, attachment controls, backups, and audit review. Do not use production incident records until these controls are verified.
