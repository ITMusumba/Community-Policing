import { ConvexError, v } from "convex/values";
import { createAccount, getAuthUserId, invalidateSessions, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const staffRole = v.union(v.literal("officer"), v.literal("admin"));

/** Readable one-time password: no 0/O/1/l/I to avoid misreading when it is handed over. */
function tempPassword() {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

export const callerProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query("userProfiles").withIndex("by_user_id", q => q.eq("userId", args.userId)).unique();
    const user = await ctx.db.get(args.userId);
    return profile ? { profile, email: user?.email ?? null } : null;
  },
});

export const checkNewStaff = internalQuery({
  args: { email: v.string(), badgeNumber: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("email", q => q.eq("email", args.email)).unique();
    if (user) return "An account with this email already exists. Change that person's role under Personnel instead.";
    if (args.badgeNumber) {
      const badge = await ctx.db.query("userProfiles").withIndex("by_badge_number", q => q.eq("badgeNumber", args.badgeNumber)).unique();
      if (badge) return "That badge number is already registered.";
    }
    return null;
  },
});

export const insertStaffProfile = internalMutation({
  args: {
    actorId: v.id("userProfiles"), userId: v.id("users"), displayName: v.string(), role: staffRole,
    badgeNumber: v.optional(v.string()), stationId: v.optional(v.id("stations")),
  },
  handler: async (ctx, args) => {
    const station = args.stationId ? await ctx.db.get(args.stationId) : null;
    const profileId = await ctx.db.insert("userProfiles", {
      userId: args.userId, displayName: args.displayName, role: args.role, badgeNumber: args.badgeNumber,
      stationId: station?._id, station: station?.name, district: station?.district,
      isActive: true, mustChangePassword: true, createdAt: Date.now(),
    });
    await ctx.db.insert("auditLogs", { actorId: args.actorId, action: "user.create_staff", entityType: "userProfile", entityId: profileId, details: [args.role, args.badgeNumber].filter(Boolean).join(" / "), createdAt: Date.now() });
    return profileId;
  },
});

export const setMustChangePassword = internalMutation({
  args: { profileId: v.id("userProfiles"), value: v.boolean(), actorId: v.id("userProfiles"), action: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { mustChangePassword: args.value });
    await ctx.db.insert("auditLogs", { actorId: args.actorId, action: args.action, entityType: "userProfile", entityId: args.profileId, createdAt: Date.now() });
  },
});

/**
 * Admin creates a police or admin account. The person cannot register themselves as staff.
 * Returns a one-time password to hand over in person; the officer must replace it on first sign-in.
 */
export const createStaffAccount = action({
  args: {
    displayName: v.string(), email: v.string(), role: staffRole,
    badgeNumber: v.optional(v.string()), stationId: v.optional(v.id("stations")),
  },
  handler: async (ctx, args): Promise<{ email: string; password: string }> => {
    const userId = await getAuthUserId(ctx);
    const caller = userId ? await ctx.runQuery(internal.staffAccounts.callerProfile, { userId }) : null;
    const actor = caller?.profile;
    if (!actor?.isActive || (actor.role !== "admin" && actor.role !== "super_admin")) throw new ConvexError("Administrator access is required.");
    if (args.role === "admin" && actor.role !== "super_admin") throw new ConvexError("Only a super-admin can create administrator accounts.");

    const displayName = args.displayName.trim();
    const email = args.email.trim().toLowerCase();
    const badgeNumber = args.badgeNumber?.trim() || undefined;
    if (displayName.length < 2 || displayName.length > 120) throw new ConvexError("Name must be between 2 and 120 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Enter a valid email address.");
    if (badgeNumber && !/^[A-Za-z0-9][A-Za-z0-9/_. -]{1,39}$/.test(badgeNumber)) throw new ConvexError("Badge number: 2–40 letters, digits, and - _ / . or spaces.");
    const problem = await ctx.runQuery(internal.staffAccounts.checkNewStaff, { email, badgeNumber });
    if (problem) throw new ConvexError(problem);

    const password = tempPassword();
    const { user } = await createAccount(ctx, { provider: "password", account: { id: email, secret: password }, profile: { email, name: displayName } });
    await ctx.runMutation(internal.staffAccounts.insertStaffProfile, {
      actorId: actor._id, userId: user._id as Id<"users">, displayName, role: args.role, badgeNumber, stationId: args.stationId,
    });
    return { email, password };
  },
});

/** Any signed-in user replaces their own password after confirming the current one. */
export const changeOwnPassword = action({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const caller = userId ? await ctx.runQuery(internal.staffAccounts.callerProfile, { userId }) : null;
    if (!caller?.email) throw new ConvexError("Please sign in again.");
    if (args.newPassword.length < 10) throw new ConvexError("Use at least 10 characters for your new password.");
    if (args.newPassword === args.currentPassword) throw new ConvexError("Choose a password different from the current one.");
    try {
      await retrieveAccount(ctx, { provider: "password", account: { id: caller.email, secret: args.currentPassword } });
    } catch {
      throw new ConvexError("Current password is incorrect.");
    }
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: caller.email, secret: args.newPassword } });
    await ctx.runMutation(internal.staffAccounts.setMustChangePassword, { profileId: caller.profile._id, value: false, actorId: caller.profile._id, action: "user.password_change" });
    return { success: true };
  },
});

/** Admin issues a new one-time password for a staff member and signs them out everywhere. */
export const resetStaffPassword = action({
  args: { profileId: v.id("userProfiles") },
  handler: async (ctx, args): Promise<{ email: string; password: string }> => {
    const userId = await getAuthUserId(ctx);
    const caller = userId ? await ctx.runQuery(internal.staffAccounts.callerProfile, { userId }) : null;
    const actor = caller?.profile;
    if (!actor?.isActive || (actor.role !== "admin" && actor.role !== "super_admin")) throw new ConvexError("Administrator access is required.");
    const target = await ctx.runQuery(internal.staffAccounts.profileWithEmail, { profileId: args.profileId });
    if (!target?.email || !target.profile.userId) throw new ConvexError("User not found.");
    if (target.profile._id === actor._id) throw new ConvexError("Use 'Change password' for your own account.");
    if (target.profile.role === "citizen") throw new ConvexError("Citizens reset their own passwords.");
    if (target.profile.role !== "officer" && actor.role !== "super_admin") throw new ConvexError("Only a super-admin can reset administrator passwords.");
    if (target.profile.role === "super_admin") throw new ConvexError("Super-admin passwords require the controlled recovery process.");

    const password = tempPassword();
    await modifyAccountCredentials(ctx, { provider: "password", account: { id: target.email, secret: password } });
    await invalidateSessions(ctx, { userId: target.profile.userId });
    await ctx.runMutation(internal.staffAccounts.setMustChangePassword, { profileId: target.profile._id, value: true, actorId: actor._id, action: "user.password_reset" });
    return { email: target.email, password };
  },
});

export const profileWithEmail = internalQuery({
  args: { profileId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    const user = profile?.userId ? await ctx.db.get(profile.userId) : null;
    return profile ? { profile, email: user?.email ?? null } : null;
  },
});
