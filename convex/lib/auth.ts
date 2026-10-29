import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type AuthContext = QueryCtx | MutationCtx;

export async function requireUser(ctx: AuthContext): Promise<Doc<"userProfiles">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue." });
  const profile = await ctx.db.query("userProfiles")
    .withIndex("by_auth_subject", q => q.eq("authSubject", identity.subject)).unique();
  if (!profile || !profile.isActive) throw new ConvexError({ code: "FORBIDDEN", message: "This account is not enabled." });
  return profile;
}

export async function requireOfficer(ctx: AuthContext): Promise<Doc<"userProfiles">> {
  const profile = await requireUser(ctx);
  if (!["officer", "admin", "super_admin"].includes(profile.role)) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Officer access is required." });
  }
  return profile;
}

export async function requireAdmin(ctx: AuthContext): Promise<Doc<"userProfiles">> {
  const profile = await requireUser(ctx);
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new ConvexError({ code: "FORBIDDEN", message: "Administrator access is required." });
  }
  return profile;
}

export async function requireSuperAdmin(ctx: AuthContext): Promise<Doc<"userProfiles">> {
  const profile = await requireUser(ctx);
  if (profile.role !== "super_admin") throw new ConvexError({ code: "FORBIDDEN", message: "Super administrator access is required." });
  return profile;
}
