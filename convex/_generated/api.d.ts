/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as complaints from "../complaints.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as messages from "../messages.js";
import type * as notices from "../notices.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as superAdmin from "../superAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  complaints: typeof complaints;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  messages: typeof messages;
  notices: typeof notices;
  profiles: typeof profiles;
  reports: typeof reports;
  seed: typeof seed;
  superAdmin: typeof superAdmin;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
