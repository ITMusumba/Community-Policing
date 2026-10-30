import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
  },
});

/**
 * Safe first-login provisioning. A new authenticated account can only become a
 * citizen here; role assignment is deliberately not accepted from the client.
 */
export const ensureCitizenProfile = mutation({
  args: { displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();
    if (!userId || !identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in before creating a profile." });
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      if (!existing.isActive) {
        throw new ConvexError({ code: "FORBIDDEN", message: "This account has been disabled." });
      }
      return existing._id;
    }

    const requestedName = args.displayName?.trim();
    const identityName =
      (typeof identity.name === "string" && identity.name.trim()) ||
      (typeof identity.email === "string" && identity.email.trim());
    const displayName = (requestedName && requestedName.length >= 2 ? requestedName : identityName) || "Community member";

    const now = Date.now();
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      displayName: displayName.slice(0, 120),
      role: "citizen",
      isActive: true,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: profileId,
      action: "profile.create",
      entityType: "userProfile",
      entityId: profileId,
      details: "citizen",
      createdAt: now,
    });

    return profileId;
  },
});

/**
 * Officer/admin roles cannot be selected by a user. Only an existing admin
 * can provision an officer after the first admin has been established through
 * the trusted operator bootstrap procedure documented in docs/authentication.md.
 */
export const provisionOfficer = mutation({
  args: {
    email: v.string(),
    displayName: v.string(),
    badgeNumber: v.string(),
    station: v.optional(v.string()),
    district: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const displayName = args.displayName.trim();
    const badgeNumber = args.badgeNumber.trim();

    if (displayName.length < 2 || displayName.length > 120) {
      throw new ConvexError("Officer name must be between 2 and 120 characters.");
    }
    if (!/^[A-Za-z0-9-]{2,40}$/.test(badgeNumber)) {
      throw new ConvexError("Badge number format is invalid.");
    }

    const email = args.email.trim();
    const user =
      (await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).unique()) ??
      (await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.toLowerCase())).unique());
    if (!user) throw new ConvexError("That person must sign up before they can be made an officer.");
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (existingProfile) throw new ConvexError("An account profile already exists for this identity.");

    const existingBadge = await ctx.db
      .query("userProfiles")
      .withIndex("by_badge_number", (q) => q.eq("badgeNumber", badgeNumber))
      .unique();
    if (existingBadge) throw new ConvexError("That badge number is already registered.");

    const profileId = await ctx.db.insert("userProfiles", {
      userId: user._id,
      displayName,
      role: "officer",
      badgeNumber,
      station: args.station?.trim().slice(0, 160),
      district: args.district?.trim().slice(0, 160),
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin._id,
      action: "profile.provision_officer",
      entityType: "userProfile",
      entityId: profileId,
      details: badgeNumber,
      createdAt: Date.now(),
    });

    return profileId;
  },
});

/**
 * One-off, CLI-only: copies the user id out of legacy "userId|sessionId" subjects.
 * Run: npx convex run profiles:backfillUserIds
 */
export const backfillUserIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    for (const profile of await ctx.db.query("userProfiles").collect()) {
      if (profile.userId || !profile.authSubject) continue;
      const user = await ctx.db.get(profile.authSubject.split("|")[0] as Id<"users">).catch(() => null);
      if (user) {
        await ctx.db.patch(profile._id, { userId: user._id });
        updated++;
      }
    }
    return { updated };
  },
});
