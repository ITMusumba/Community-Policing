import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOfficer } from "./lib/auth";

export const publicFeed = query({
  args: {},
  handler: async (ctx) => {
    const notices = await ctx.db
      .query("notices")
      .withIndex("by_published_created", (q) => q.eq("published", true))
      .order("desc")
      .take(100);
    return notices.filter((notice) => notice.audience === "public");
  },
});

export const officerFeed = query({
  args: {},
  handler: async (ctx) => {
    await requireOfficer(ctx);
    return await ctx.db
      .query("notices")
      .withIndex("by_published_created", (q) => q.eq("published", true))
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    audience: v.union(v.literal("public"), v.literal("officers")),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const author = await requireOfficer(ctx);
    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length < 4 || title.length > 160) throw new ConvexError("Title must be between 4 and 160 characters.");
    if (body.length < 5 || body.length > 10000) throw new ConvexError("Notice body must be between 5 and 10,000 characters.");

    const now = Date.now();
    const noticeId = await ctx.db.insert("notices", {
      authorId: author._id,
      title,
      body,
      audience: args.audience,
      published: args.published,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLogs", {
      actorId: author._id,
      action: args.published ? "notice.publish" : "notice.create",
      entityType: "notice",
      entityId: noticeId,
      createdAt: now,
    });
    return noticeId;
  },
});
