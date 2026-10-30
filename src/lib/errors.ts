import { ConvexError } from "convex/values";

/**
 * User-facing text for a failed Convex call. Production deployments hide normal error text behind
 * "Server Error", but a ConvexError thrown on purpose (validation, permissions) carries its message in `data`.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as unknown;
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") return data.message;
  }
  if (error instanceof Error && !/Server Error|Request ID/.test(error.message)) return error.message;
  return fallback;
}
