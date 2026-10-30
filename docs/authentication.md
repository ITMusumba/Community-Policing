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

## Identity and profiles

Convex Auth issues a token whose `subject` is `userId|sessionId`, which changes on every sign-in. Profiles are therefore
keyed by the stable Convex Auth user id (`userProfiles.userId`, index `by_user_id`) read with `getAuthUserId`, never by `subject`.
The legacy `authSubject` field is optional and only kept for old rows. To backfill any old rows once:

```bash
npx convex run profiles:backfillUserIds
```

## First super administrator bootstrap

There is no public way to become an administrator. The first super admin is created by the project operator from a terminal,
through an internal Convex function that the web app cannot call:

1. Sign up with the intended email on the live site (`/super-admin` or the citizen app). This creates a citizen account.
2. Run, against the deployment you want (add `--prod` for production):

   ```bash
   npx convex run --prod superAdmin:bootstrap '{"email":"you@example.com"}'
   ```

3. Sign in at `/super-admin`. The function refuses to run again once a super admin exists unless `{"force":true}` is passed,
   and writes an audit log entry.

Required Convex environment variables: `CONVEX_SITE_URL`, `JWT_PRIVATE_KEY` and `JWKS` (generate the key pair with
`npx @convex-dev/auth`).

## Creating officers

1. The officer registers as a citizen on the citizen app.
2. At `/super-admin`, the super admin sets the account's role to officer (or admin).
3. The super admin then picks the officer's station and badge number. The district is taken from the station.
4. The officer signs in at `/police` (staff sign-in only, no registration there). A plain officer sees only reports in their district.

## Before production

- Add password reset and account recovery guidance.
- Decide whether email verification is required before reports can be submitted.
- Add rate limiting and abuse controls appropriate to the deployment.
- Configure session persistence for Capacitor and review secure storage requirements.
- Test sign-up, sign-in, sign-out, invalid credentials, disabled accounts, and authorization denial.
- Review privacy notices, retention, evidence attachment policy, access logs, and account deletion obligations.
- Do not enter real incident reports or complainant data until these checks are complete.
