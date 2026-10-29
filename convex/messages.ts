import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOfficer, requireUser } from "./lib/auth";

export const startForReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("Report not found.");

    const isReporter = report.reporterId === user._id;
    const isOfficer = user.role === "officer" || user.role === "admin";
    if (!isReporter && !isOfficer) throw new ConvexError("You cannot open a conversation for this report.");

    const officerId = report.assignedOfficerId ?? (isOfficer ? user._id : undefined);
    if (!officerId) throw new ConvexError("An officer must be assigned before a conversation can be opened.");
    const participants = [report.reporterId, officerId];
    const existing = await ctx.db.query("conversations").collect();
    const conversation = existing.find((item) =>
      item.reportId === args.reportId &&
      item.participantIds.length === 2 &&
      participants.every((id) => item.participantIds.some((participantId) => participantId === id))
    );
    if (conversation) return conversation._id;

    return await ctx.db.insert("conversations", {
      participantIds: participants,
      reportId: args.reportId,
      updatedAt: Date.now(),
    });
  },
});

export const myConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const all = await ctx.db.query("conversations").withIndex("by_updated_at").order("desc").take(200);
    return all.filter((conversation) => conversation.participantIds.includes(user._id));
  },
});

export const listMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participantIds.includes(user._id)) {
      throw new ConvexError("Conversation not found or access denied.");
    }
    return await ctx.db.query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(200);
  },
});

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || !conversation.participantIds.includes(user._id)) {
      throw new ConvexError("Conversation not found or access denied.");
    }
    const body = args.body.trim();
    if (!body || body.length > 5000) throw new ConvexError("Message must be between 1 and 5,000 characters.");

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: user._id,
      body,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { updatedAt: now });
    await ctx.db.insert("auditLogs", {
      actorId: user._id,
      action: "message.send",
      entityType: "conversation",
      entityId: args.conversationId,
      createdAt: now,
    });
    return messageId;
  },
});
