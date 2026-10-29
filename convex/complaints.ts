import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOfficer, requireUser } from "./lib/auth";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
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

    const now = Date.now();
    const complaintId = await ctx.db.insert("complaints", {
      reporterId: user._id,
      title,
      description,
      category: args.category.trim().slice(0, 100),
      priority: args.priority,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      action: "complaint.create",
      entityType: "complaint",
      entityId: complaintId,
      createdAt: now,
    });
    return complaintId;
  },
});

export const myComplaints = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return await ctx.db
      .query("complaints")
      .withIndex("by_reporter", (q) => q.eq("reporterId", user._id))
      .order("desc")
      .take(100);
  },
});

export const officerFeed = query({
  args: {},
  handler: async (ctx) => {
    await requireOfficer(ctx);
    return await ctx.db.query("complaints").withIndex("by_created_at").order("desc").take(100);
  },
});

export const updateStatus = mutation({
  args: {
    complaintId: v.id("complaints"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    const actor = await requireOfficer(ctx);
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new ConvexError("Complaint not found.");

    const now = Date.now();
    await ctx.db.patch(args.complaintId, { status: args.status, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "complaint.status.update",
      entityType: "complaint",
      entityId: args.complaintId,
      details: args.status,
      createdAt: now,
    });
    return { success: true };
  },
});

export const assignOfficer = mutation({
  args: {
    complaintId: v.id("complaints"),
    officerId: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    const actor = await requireOfficer(ctx);
    const target = await ctx.db.get(args.officerId);
    const complaint = await ctx.db.get(args.complaintId);
    if (!complaint) throw new ConvexError("Complaint not found.");
    if (!target || !target.isActive || (target.role !== "officer" && target.role !== "admin")) {
      throw new ConvexError("Select an active officer.");
    }

    const now = Date.now();
    await ctx.db.patch(args.complaintId, { assignedOfficerId: target._id, updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorId: actor._id,
      action: "complaint.assign",
      entityType: "complaint",
      entityId: args.complaintId,
      details: target._id,
      createdAt: now,
    });
    return { success: true };
  },
});
