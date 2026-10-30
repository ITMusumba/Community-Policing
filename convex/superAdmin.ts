import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireSuperAdmin } from "./lib/auth";

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const profiles = await ctx.db.query("userProfiles").collect();
    return profiles.map(({ _id, displayName, role, badgeNumber, station, stationId, district, isActive, createdAt }) => ({
      _id, displayName, role, badgeNumber, station, stationId, district, isActive, createdAt,
    }));
  },
});

export const setUserActive = mutation({
  args: { userId: v.id("userProfiles"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");
    if (target._id === actor._id) throw new ConvexError("You cannot disable your own super-admin account.");
    if (target.role === "super_admin") throw new ConvexError("Super-admin accounts require a separate controlled recovery process.");
    await ctx.db.patch(target._id, { isActive: args.isActive });
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: args.isActive ? "user.enable" : "user.disable", entityType: "userProfile", entityId: target._id, createdAt: Date.now() });
    return { success: true };
  },
});

export const setUserRole = mutation({
  args: { userId: v.id("userProfiles"), role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin")) },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");
    if (target._id === actor._id || target.role === "super_admin") throw new ConvexError("Super-admin role cannot be changed here.");
    await ctx.db.patch(target._id, { role: args.role });
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: "user.role.update", entityType: "userProfile", entityId: target._id, details: args.role, createdAt: Date.now() });
    return { success: true };
  },
});

/**
 * CLI-only (not callable from the web). The person must have signed up first.
 * Run: npx convex run --prod superAdmin:bootstrap '{"email":"you@example.com"}'
 * Refuses if a super admin already exists unless force is true.
 */
export const bootstrap = internalMutation({
  args: { email: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const email = args.email.trim();
    const user =
      (await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).unique()) ??
      (await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.toLowerCase())).unique());
    if (!user) throw new ConvexError("No account with that email. Sign up on the site first, then run this again.");

    const existingSuper = await ctx.db.query("userProfiles").withIndex("by_role", (q) => q.eq("role", "super_admin")).first();
    if (existingSuper && !args.force) throw new ConvexError("A super admin already exists. Pass force:true to add another.");

    const now = Date.now();
    const profile = await ctx.db.query("userProfiles").withIndex("by_user_id", (q) => q.eq("userId", user._id)).unique();
    let profileId;
    if (profile) {
      await ctx.db.patch(profile._id, { role: "super_admin", isActive: true });
      profileId = profile._id;
    } else {
      profileId = await ctx.db.insert("userProfiles", {
        userId: user._id,
        displayName: (user.name ?? user.email ?? "Super admin").slice(0, 120),
        role: "super_admin",
        isActive: true,
        createdAt: now,
      });
    }
    await ctx.db.insert("auditLogs", { actorId: profileId, action: "superadmin.bootstrap", entityType: "userProfile", entityId: profileId, createdAt: now });
    return { profileId };
  },
});

export const setOfficerDetails = mutation({
  args: { userId: v.id("userProfiles"), stationId: v.optional(v.id("stations")), badgeNumber: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found.");
    if (target.role !== "officer" && target.role !== "admin") throw new ConvexError("Set the role to officer or admin first.");

    const patch: Partial<Doc<"userProfiles">> = {};
    const badge = args.badgeNumber?.trim();
    if (badge) {
      if (!/^[A-Za-z0-9-]{2,40}$/.test(badge)) throw new ConvexError("Badge number format is invalid.");
      const duplicate = await ctx.db.query("userProfiles").withIndex("by_badge_number", (q) => q.eq("badgeNumber", badge)).unique();
      if (duplicate && duplicate._id !== target._id) throw new ConvexError("That badge number is already registered.");
      patch.badgeNumber = badge;
    }
    if (args.stationId) {
      const station = await ctx.db.get(args.stationId);
      if (!station) throw new ConvexError("Station not found.");
      patch.stationId = station._id;
      patch.station = station.name;
      patch.district = station.district;
    } else {
      patch.stationId = undefined;
      patch.station = undefined;
    }
    await ctx.db.patch(target._id, patch);
    await ctx.db.insert("auditLogs", {
      actorId: actor._id, action: "user.officer_details", entityType: "userProfile", entityId: target._id,
      details: [badge, patch.station].filter(Boolean).join(" / ") || undefined, createdAt: Date.now(),
    });
    return { success: true };
  },
});
