import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    authSubject: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin")),
    badgeNumber: v.optional(v.string()),
    station: v.optional(v.string()),
    district: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_badge_number", ["badgeNumber"]),

  reports: defineTable({
    reporterId: v.id("userProfiles"),
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
    status: v.union(v.literal("pending"), v.literal("under_review"), v.literal("investigating"), v.literal("resolved"), v.literal("dismissed")),
    locationText: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    assignedOfficerId: v.optional(v.id("userProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_reporter", ["reporterId"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_assigned_officer", ["assignedOfficerId"]),

  reportUpdates: defineTable({
    reportId: v.id("reports"),
    actorId: v.id("userProfiles"),
    fromStatus: v.optional(v.string()),
    toStatus: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_report_created", ["reportId", "createdAt"]),

  complaints: defineTable({
    reporterId: v.id("userProfiles"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    assignedOfficerId: v.optional(v.id("userProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_reporter", ["reporterId"])
    .index("by_assigned_officer", ["assignedOfficerId"]),

  notices: defineTable({
    authorId: v.id("userProfiles"),
    title: v.string(),
    body: v.string(),
    audience: v.union(v.literal("public"), v.literal("officers")),
    published: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_published_created", ["published", "createdAt"]),

  conversations: defineTable({
    participantIds: v.array(v.id("userProfiles")),
    reportId: v.optional(v.id("reports")),
    complaintId: v.optional(v.id("complaints")),
    updatedAt: v.number(),
  }).index("by_updated_at", ["updatedAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("userProfiles"),
    body: v.string(),
    attachmentStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  }).index("by_conversation_created", ["conversationId", "createdAt"]),

  officerReports: defineTable({
    authorId: v.id("userProfiles"),
    relatedReportId: v.optional(v.id("reports")),
    title: v.string(),
    narrative: v.string(),
    actionsTaken: v.string(),
    outcome: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted")),
    createdAt: v.number(),
    updatedAt: v.number(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_author_updated", ["authorId", "updatedAt"])
    .index("by_related_report", ["relatedReportId"]),

  auditLogs: defineTable({
    actorId: v.id("userProfiles"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_entity_created", ["entityType", "entityId", "createdAt"]),
});
