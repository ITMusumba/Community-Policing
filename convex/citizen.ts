import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { tokenHash } from "./reports";

async function requireCitizen(ctx: QueryCtx | MutationCtx) {
  const profile = await requireUser(ctx);
  if (profile.role !== "citizen") throw new ConvexError({ code: "FORBIDDEN", message: "Citizen account required." });
  return profile;
}

async function ownReport(ctx: QueryCtx | MutationCtx, reportId: Id<"reports">) {
  const citizen = await requireCitizen(ctx);
  const report = await ctx.db.get(reportId);
  if (!report || report.reporterId !== citizen._id) throw new ConvexError("Report not found.");
  return report;
}

/** The signed-in citizen's reports with progress and police replies. Officer identities are not shown. */
export const myReports = query({
  args: {},
  handler: async ctx => {
    const citizen = await requireCitizen(ctx);
    const reports = await ctx.db.query("reports").withIndex("by_reporter", q => q.eq("reporterId", citizen._id)).collect();
    reports.sort((a, b) => b.updatedAt - a.updatedAt);
    return await Promise.all(reports.slice(0, 50).map(async r => {
      const notes = await ctx.db.query("reportNotes").withIndex("by_report_created", q => q.eq("reportId", r._id)).order("asc").collect();
      const updates = await ctx.db.query("reportUpdates").withIndex("by_report_created", q => q.eq("reportId", r._id)).order("asc").take(30);
      return {
        _id: r._id, trackingCode: r.trackingCode, category: r.category, status: r.status, shareIdentity: r.shareIdentity === true,
        place: [r.parish, r.subcounty, r.district].filter(Boolean).join(", "), createdAt: r.createdAt, updatedAt: r.updatedAt,
        unread: notes.filter(n => n.author === "officer" && n.createdAt > (r.citizenSeenAt ?? 0)).length,
        notes: notes.map(n => ({ _id: n._id, author: n.author, body: n.body, hasAttachment: !!n.storageId, createdAt: n.createdAt })),
        updates: updates.map(u => ({ _id: u._id, toStatus: u.toStatus, createdAt: u.createdAt })),
      };
    }));
  },
});

export const markSeen = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const report = await ownReport(ctx, args.reportId);
    await ctx.db.patch(report._id, { citizenSeenAt: Date.now() });
  },
});

export const addNote = mutation({
  args: { reportId: v.id("reports"), body: v.string() },
  handler: async (ctx, args) => {
    const report = await ownReport(ctx, args.reportId);
    if (["closed", "duplicate", "false"].includes(report.status)) throw new ConvexError("This report is closed.");
    const body = args.body.trim().slice(0, 3000);
    if (!body) throw new ConvexError("Message cannot be empty.");
    const now = Date.now();
    const recent = await ctx.db.query("reportNotes").withIndex("by_report_created", q => q.eq("reportId", report._id).gt("createdAt", now - 60 * 60 * 1000)).collect();
    if (recent.filter(n => n.author === "citizen").length >= 20) throw new ConvexError("Too many updates. Please wait a little and try again.");
    await ctx.db.insert("reportNotes", { reportId: report._id, author: "citizen", body, createdAt: now });
    await ctx.db.patch(report._id, { updatedAt: now, citizenSeenAt: now });
  },
});

/**
 * Links reports sent anonymously from this device (code + secret token kept in localStorage) to the signed-in account.
 * Reports already linked to someone else are left alone. Identity stays hidden from police.
 */
export const claimReports = mutation({
  args: { items: v.array(v.object({ code: v.string(), token: v.string() })) },
  handler: async (ctx, args) => {
    const citizen = await requireCitizen(ctx);
    let claimed = 0;
    for (const item of args.items.slice(0, 50)) {
      const report = await ctx.db.query("reports").withIndex("by_tracking_code", q => q.eq("trackingCode", item.code.trim().toUpperCase())).unique();
      if (!report || report.reporterId || report.followUpTokenHash !== await tokenHash(item.token)) continue;
      await ctx.db.patch(report._id, { reporterId: citizen._id, shareIdentity: false });
      claimed++;
    }
    return { claimed };
  },
});

export const updateMyDetails = mutation({
  args: { displayName: v.string(), phone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);
    const displayName = args.displayName.trim();
    if (displayName.length < 2 || displayName.length > 120) throw new ConvexError("Name must be between 2 and 120 characters.");
    const phone = args.phone?.trim() || undefined;
    if (phone && !/^\+?[0-9 ]{9,16}$/.test(phone)) throw new ConvexError("Enter a valid phone number, e.g. +256 772 123456.");
    await ctx.db.patch(profile._id, { displayName, phone });
  },
});
