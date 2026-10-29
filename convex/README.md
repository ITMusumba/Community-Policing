# Convex backend setup

1. Install dependencies with `npm install`.
2. Run `npx convex dev` and follow the prompts to create or select a Convex deployment.
3. Set `NEXT_PUBLIC_CONVEX_URL` in your local environment to the deployment URL.
4. Configure an authentication provider in Convex before enabling protected features. The provider must issue a stable identity subject that matches `userProfiles.authSubject`.
5. Create user profiles through a trusted administrative provisioning flow. Do not let clients self-assign officer or admin roles.
6. Run `npx convex dev` to generate the `convex/_generated` files required by imports in the functions.

## Important

The functions intentionally reject unauthenticated access. Do not add a demo authentication bypass. This starter does not yet configure an authentication provider or officer provisioning workflow, so protected functions will not be usable until those are configured.

Incident records can contain sensitive personal information. Establish access policy, retention, disclosure, deletion, attachment controls, backups, and audit review before using production data.
