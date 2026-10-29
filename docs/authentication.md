# Authentication and account provisioning

This project uses Convex Auth with the password provider for the first client-side sign-in flow. Convex Auth is in beta. We intentionally use the client-side provider rather than experimental Next.js server-side authentication because the app is configured for static export and Capacitor packaging.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Convex setup:
   ```bash
   npx convex dev
   ```
   Follow the prompts to create or select the Community Policing Convex project. This generates the `convex/_generated` TypeScript files.
3. Copy the Convex cloud URL into `.env.local`:
   ```dotenv
   NEXT_PUBLIC_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud
   ```
4. In the Convex deployment environment, set `CONVEX_SITE_URL` to the matching HTTPS `.convex.site` URL:
   ```bash
   npx convex env set CONVEX_SITE_URL https://YOUR-DEPLOYMENT.convex.site
   ```
5. Keep `npx convex dev` running while developing the web app. In another terminal:
   ```bash
   npm run dev
   ```

The exact URLs are provided by your own Convex deployment. Do not use the example values literally.

## Registration behavior

- Email/password registration is open to citizens.
- A first-login mutation creates a citizen profile only.
- The client cannot send a role value when creating a profile.
- Officer provisioning requires an existing administrator and checks for duplicate badge numbers.
- Never store plaintext passwords or copy the old Firebase officer creation function.

## First administrator bootstrap

The first administrator must be provisioned by a trusted project operator, not by an unauthenticated public function. Recommended controlled procedure:

1. Sign up with the intended administrator email through the app after the Convex deployment is configured.
2. Identify that account in the Convex Auth `users` table in the Convex dashboard.
3. Using the authenticated user's stable subject (the ID represented in the identity's `subject` claim), create or update the matching `userProfiles` record with `role: "admin"` and `isActive: true` through a restricted, audited operator process.
4. Confirm the account can access administrator-only operations and an ordinary citizen account cannot.
5. Remove or disable any temporary bootstrap access used during setup.

Do not add a public “make me admin” mutation. Do not grant administrator access based only on an email address supplied by a client.

## Before production

- Add password reset and account recovery guidance.
- Decide whether email verification is required before reports can be submitted.
- Add rate limiting and abuse controls appropriate to the deployment.
- Configure session persistence for Capacitor and review secure storage requirements.
- Test sign-up, sign-in, sign-out, invalid credentials, disabled accounts, and authorization denial.
- Review privacy notices, retention, evidence attachment policy, access logs, and account deletion obligations.
- Do not enter real incident reports or complainant data until these checks are complete.
