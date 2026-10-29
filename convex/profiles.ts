import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in before creating a profile." });
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
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
      authSubject: identity.subject,
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
    authSubject: v.string(),
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

    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", args.authSubject))
      .unique();
    if (existingProfile) throw new ConvexError("An account profile already exists for this identity.");

    const existingBadge = await ctx.db
      .query("userProfiles")
      .withIndex("by_badge_number", (q) => q.eq("badgeNumber", badgeNumber))
      .unique();
    if (existingBadge) throw new ConvexError("That badge number is already registered.");

    const profileId = await ctx.db.insert("userProfiles", {
      authSubject: args.authSubject,
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
