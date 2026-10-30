import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const crimeCategory = v.union(
  v.literal("theft"), v.literal("robbery"), v.literal("assault"),
  v.literal("domestic_violence"), v.literal("sexual_violence"),
  v.literal("accident"), v.literal("fire"), v.literal("drugs"),
  v.literal("suspicious_activity"), v.literal("livestock_theft"),
  v.literal("land_property_dispute"), v.literal("other")
);
const reportStatus = v.union(
  v.literal("received"), v.literal("seen"), v.literal("assigned"),
  v.literal("en_route"), v.literal("closed"), v.literal("duplicate"),
  v.literal("false")
);

export default defineSchema({
  ...authTables,

  userProfiles: defineTable({
    // Stable Convex Auth user id. authSubject is legacy ("userId|sessionId", changes per session).
    userId: v.optional(v.id("users")),
    authSubject: v.optional(v.string()),
    displayName: v.string(),
    role: v.union(v.literal("citizen"), v.literal("officer"), v.literal("admin"), v.literal("super_admin")),
    badgeNumber: v.optional(v.string()),
    station: v.optional(v.string()),
    stationId: v.optional(v.id("stations")),
    district: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_auth_subject", ["authSubject"])
    .index("by_badge_number", ["badgeNumber"])
    .index("by_role", ["role"])
    .index("by_district", ["district"])
    .index("by_station", ["stationId"]),

  reports: defineTable({
    reporterId: v.optional(v.id("userProfiles")),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: crimeCategory,
    status: reportStatus,
    trackingCode: v.string(),
    followUpTokenHash: v.string(),
    deviceHash: v.string(),
    stationId: v.optional(v.id("stations")),
    district: v.optional(v.string()),
    subcounty: v.optional(v.string()),
    parish: v.optional(v.string()),
    accuracyM: v.optional(v.number()),
    verified: v.boolean(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    assignedOfficerId: v.optional(v.id("userProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
    closedAt: v.optional(v.number()),
    incidentClusterId: v.optional(v.id("reports")),
  })
    .index("by_tracking_code", ["trackingCode"])
    .index("by_device_created", ["deviceHash", "createdAt"])
    .index("by_created_at", ["createdAt"])
    .index("by_reporter", ["reporterId"])
    .index("by_district_created", ["district", "createdAt"])
    .index("by_subcounty_created", ["subcounty", "createdAt"])
    .index("by_parish_created", ["parish", "createdAt"])
    .index("by_station_created", ["stationId", "createdAt"])
    .index("by_status_created", ["status", "createdAt"])
    .index("by_assigned_officer", ["assignedOfficerId"]),

  reportMedia: defineTable({
    reportId: v.id("reports"),
    storageId: v.id("_storage"),
    kind: v.union(v.literal("photo"), v.literal("video"), v.literal("voice")),
    createdAt: v.number(),
  }).index("by_report_created", ["reportId", "createdAt"]),

  stations: defineTable({
    name: v.string(),
    type: v.union(v.literal("station"), v.literal("post"), v.literal("community_policing_point")),
    lat: v.number(),
    lng: v.number(),
    phone: v.optional(v.string()),
    district: v.string(),
    subcounty: v.string(),
    parish: v.string(),
    verified: v.boolean(),
  })
    .index("by_district", ["district"])
    .index("by_name", ["name"]),

  reportNotes: defineTable({
    reportId: v.id("reports"),
    author: v.union(v.literal("citizen"), v.literal("officer")),
    body: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_report_created", ["reportId", "createdAt"]),

  reportUpdates: defineTable({
    reportId: v.id("reports"),
    actorId: v.optional(v.id("userProfiles")),
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
  })
    .index("by_updated_at", ["updatedAt"])
    .index("by_report", ["reportId"]),

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

  uploadLog: defineTable({
    key: v.string(),
    createdAt: v.number(),
  }).index("by_key_created", ["key", "createdAt"]),

  auditLogs: defineTable({
    actorId: v.optional(v.id("userProfiles")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    details: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_entity_created", ["entityType", "entityId", "createdAt"]),
});
