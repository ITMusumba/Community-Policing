import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOfficer, requireUser } from "./lib/auth";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.union(
      v.literal("misconduct"),
      v.literal("excessive_force"),
      v.literal("corruption"),
      v.literal("discrimination"),
      v.literal("public_safety"),
      v.literal("other")
    ),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    locationText: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    const description = args.description.trim();

    if (title.length < 4 || title.length > 160) {
      throw new ConvexError("Title must be between 4 and 160 characters.");
    }
    if (description.length < 10 || description.length > 10000) {
      throw new ConvexError("Description must be between 10 and 10,000 characters.");
    }
    if (
      (args.latitude !== undefined && (args.latitude < -90 || args.latitude > 90)) ||
      (args.longitude !== undefined && (args.longitude < -180 || args.longitude > 180))
    ) {
      throw new ConvexError("The supplied coordinates are invalid.");
    }

    const now = Date.now();
    const reportId = await ctx.db.insert("reports", {
      reporterId: user._id,
      title,
      description,
      category: args.category,
      priority: args.priority,
      status: "pending",
      locationText: args.locationText?.trim().slice(0, 500),
      latitude: args.latitude,
      longitude: args.longitude,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("reportUpdates", {
      reportId,
      actorId: user._id,
      toStatus: "pending",
      note: "Report submitted",
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      action: "report.create",
      entityType: "report",
      entityId: reportId,
      createdAt: now,
    });

    return reportId;
  },
});

export const myReports = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", user._id))
      .order("desc")
      .take(100);
  },
});

export const officerFeed = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("under_review"), v.literal("investigating"), v.literal("resolved"), v.literal("dismissed"))),
  },
  handler: async (ctx, args) => {
    await requireOfficer(ctx);
    if (args.status) {
      return await ctx.db
        .query("reports")
        .withIndex("by_status_created", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(100);
    }
    return await ctx.db.query("reports").withIndex("by_created_at").order("desc").take(100);
  },
});

export const updateStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(v.literal("under_review"), v.literal("investigating"), v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireOfficer(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("Report not found.");

    const now = Date.now();
    await ctx.db.patch(args.reportId, {
      status: args.status,
      updatedAt: now,
      ...(args.status === "resolved" || args.status === "dismissed" ? { closedAt: now } : {}),
    });
    await ctx.db.insert("reportUpdates", {
      reportId: args.reportId,
      actorId: actor._id,
      fromStatus: report.status,
      toStatus: args.status,
      note: args.note?.trim().slice(0, 2000),
      createdAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "report.status.update",
      entityType: "report",
      entityId: args.reportId,
      details: args.status,
      createdAt: now,
    });
    return { success: true };
  },
});
