import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
