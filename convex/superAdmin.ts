import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireSuperAdmin } from "./lib/auth";

const OPEN = new Set(["received", "seen", "assigned", "en_route"]);
const who = (p: Doc<"userProfiles"> | null) => (p ? `${p.displayName}${p.badgeNumber ? ` (${p.badgeNumber})` : ""}` : "Unknown");

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const profiles = await ctx.db.query("userProfiles").collect();
    return await Promise.all(profiles.map(async ({ _id, displayName, role, badgeNumber, station, stationId, district, isActive, createdAt }) => {
      const assigned = role === "citizen" ? [] : await ctx.db.query("reports").withIndex("by_assigned_officer", q => q.eq("assignedOfficerId", _id)).collect();
      return { _id, displayName, role, badgeNumber, station, stationId, district, isActive, createdAt, openCases: assigned.filter(r => OPEN.has(r.status)).length };
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
      if (!/^[A-Za-z0-9][A-Za-z0-9/_. -]{1,39}$/.test(badge)) throw new ConvexError("Badge number: 2–40 letters, digits, and - _ / . or spaces.");
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

/** Full service record of one officer: cases held and every recorded action. Read access is itself audited by the UI caller. */
export const officerRecord = query({
  args: { userId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    const officer = await ctx.db.get(args.userId);
    if (!officer) throw new ConvexError("User not found.");
    const assigned = await ctx.db.query("reports").withIndex("by_assigned_officer", q => q.eq("assignedOfficerId", officer._id)).collect();
    const actions = await ctx.db.query("auditLogs").withIndex("by_actor_created", q => q.eq("actorId", officer._id)).order("desc").take(100);
    const refs = new Map<string, string>();
    for (const a of actions) if (a.entityType === "report" && !refs.has(a.entityId)) {
      const id = ctx.db.normalizeId("reports", a.entityId);
      const r = id ? await ctx.db.get(id) : null;
      refs.set(a.entityId, r ? (r.referenceNumber ?? r.trackingCode) : a.entityId);
    }
    const toCase = (r: Doc<"reports">) => ({ _id: r._id, ref: r.referenceNumber ?? r.trackingCode, category: r.category, status: r.status, priority: r.priority ?? "p4", createdAt: r.createdAt, updatedAt: r.updatedAt, place: [r.parish, r.subcounty, r.district].filter(Boolean).join(", ") });
    return {
      officer: { _id: officer._id, name: who(officer), role: officer.role, station: officer.station, district: officer.district, isActive: officer.isActive },
      openCases: assigned.filter(r => OPEN.has(r.status)).sort((a, b) => a.createdAt - b.createdAt).map(toCase),
      closedCases: assigned.filter(r => !OPEN.has(r.status)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50).map(toCase),
      actions: actions.map(a => ({ _id: a._id, action: a.action, details: a.details, createdAt: a.createdAt, entity: a.entityType === "report" ? refs.get(a.entityId) : a.entityType })),
    };
  },
});

/**
 * Hand over every open case held by one officer to another, as a recorded handover on each case.
 * Optionally disables the departing officer's account in the same step. Their history stays under their name.
 */
export const handoverCases = mutation({
  args: { fromUserId: v.id("userProfiles"), toUserId: v.id("userProfiles"), reason: v.string(), disableAccount: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const reason = args.reason.trim().slice(0, 500);
    if (!reason) throw new ConvexError("A reason for the handover is required.");
    if (args.fromUserId === args.toUserId) throw new ConvexError("Choose a different receiving officer.");
    const from = await ctx.db.get(args.fromUserId);
    const to = await ctx.db.get(args.toUserId);
    if (!from) throw new ConvexError("Departing officer not found.");
    if (!to || !to.isActive || (to.role !== "officer" && to.role !== "admin" && to.role !== "super_admin")) throw new ConvexError("The receiving officer must be an active police account.");
    const now = Date.now();
    const cases = (await ctx.db.query("reports").withIndex("by_assigned_officer", q => q.eq("assignedOfficerId", from._id)).collect()).filter(r => OPEN.has(r.status));
    const note = `Handed over from ${who(from)} to ${who(to)} — ${reason}`;
    for (const r of cases) {
      await ctx.db.patch(r._id, { assignedOfficerId: to._id, updatedAt: now });
      await ctx.db.insert("reportUpdates", { reportId: r._id, actorId: actor._id, fromStatus: r.status, toStatus: r.status, note, createdAt: now });
      await ctx.db.insert("auditLogs", { actorId: actor._id, action: "report.handover", entityType: "report", entityId: r._id, details: note, createdAt: now });
    }
    if (args.disableAccount) {
      if (from._id === actor._id || from.role === "super_admin") throw new ConvexError("Super-admin accounts cannot be disabled here.");
      await ctx.db.patch(from._id, { isActive: false });
      await ctx.db.insert("auditLogs", { actorId: actor._id, action: "user.disable", entityType: "userProfile", entityId: from._id, details: reason, createdAt: now });
    }
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: "user.handover", entityType: "userProfile", entityId: from._id, details: `${cases.length} case(s) to ${who(to)} — ${reason}`, createdAt: now });
    return { moved: cases.length };
  },
});

export const listStationsForReview = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return (await ctx.db.query("stations").collect()).sort((a, b) => a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
  },
});

export const setStationsVerified = mutation({
  args: { stationIds: v.array(v.id("stations")), verified: v.boolean() },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    if (args.stationIds.length > 200) throw new ConvexError("Update at most 200 stations at a time.");
    for (const id of args.stationIds) await ctx.db.patch(id, { verified: args.verified });
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: args.verified ? "station.verify" : "station.unverify", entityType: "station", entityId: args.stationIds[0] ?? "", details: `${args.stationIds.length} stations`, createdAt: Date.now() });
    return { updated: args.stationIds.length };
  },
});

export const deleteStation = mutation({
  args: { stationId: v.id("stations") },
  handler: async (ctx, args) => {
    const actor = await requireSuperAdmin(ctx);
    const inUse = await ctx.db.query("reports").withIndex("by_station_created", q => q.eq("stationId", args.stationId)).first();
    if (inUse) throw new ConvexError("This station has reports. Unverify it instead of deleting.");
    await ctx.db.delete(args.stationId);
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: "station.delete", entityType: "station", entityId: args.stationId, createdAt: Date.now() });
    return { success: true };
  },
});
