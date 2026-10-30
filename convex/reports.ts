import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOfficer } from "./lib/auth";

const category = v.union(
  v.literal("theft"), v.literal("robbery"), v.literal("assault"), v.literal("domestic_violence"),
  v.literal("sexual_violence"), v.literal("accident"), v.literal("fire"), v.literal("drugs"),
  v.literal("suspicious_activity"), v.literal("livestock_theft"), v.literal("land_property_dispute"), v.literal("other")
);
const status = v.union(
  v.literal("received"), v.literal("seen"), v.literal("assigned"), v.literal("en_route"),
  v.literal("closed"), v.literal("duplicate"), v.literal("false")
);
const media = v.array(v.object({ storageId: v.id("_storage"), kind: v.union(v.literal("photo"), v.literal("video"), v.literal("voice")) }));

function tokenHash(token: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    .then(buffer => Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join(""));
}
function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function makeTrackingCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `CP-${Array.from(bytes.slice(0, 4), b => alphabet[b % alphabet.length]).join("")}-${String(10 + (bytes[4] % 90))}`;
}
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// TODO: replace nearest-station demo matching with UBOS administrative-boundary polygon lookup.
async function assignArea(ctx: any, lat?: number, lng?: number, fallbackStationId?: any) {
  const stations = await ctx.db.query("stations").collect();
  if (fallbackStationId) {
    const selected = stations.find((s: any) => s._id === fallbackStationId);
    if (selected) return selected;
  }
  if (lat === undefined || lng === undefined || stations.length === 0) return null;
  return stations.reduce((nearest: any, station: any) => {
    const d = distanceKm(lat, lng, station.lat, station.lng);
    return !nearest || d < nearest.distance ? { station, distance: d } : nearest;
  }, null)?.station ?? null;
}

const MEDIA_LIMITS = {
  photo: { max: 10 * 1024 * 1024, prefix: "image/" },
  video: { max: 50 * 1024 * 1024, prefix: "video/" },
  voice: { max: 10 * 1024 * 1024, prefix: "audio/" },
} as const;
async function validateMedia(ctx: any, storageId: any, kind: keyof typeof MEDIA_LIMITS) {
  const meta = await ctx.db.system.get(storageId);
  const limit = MEDIA_LIMITS[kind];
  if (!meta || meta.size > limit.max || !String(meta.contentType ?? "").startsWith(limit.prefix)) {
    throw new ConvexError("That file is not allowed. Use a smaller photo, video or voice note.");
  }
}

/**
 * Upload URLs are throttled: 30 per hour per anonymous device key, or per report when the caller proves
 * ownership with the tracking code and secret token. File size and type are checked when the file is attached.
 */
export const generateUploadUrl = mutation({
  args: { deviceHash: v.optional(v.string()), code: v.optional(v.string()), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let key: string;
    if (args.code && args.token) {
      const report = await ctx.db.query("reports").withIndex("by_tracking_code", q => q.eq("trackingCode", args.code!.trim().toUpperCase())).unique();
      if (!report || report.followUpTokenHash !== await tokenHash(args.token)) throw new ConvexError("Tracking code or secret token is invalid.");
      key = `report:${report._id}`;
    } else if (args.deviceHash && args.deviceHash.length >= 32 && args.deviceHash.length <= 128) {
      key = `device:${args.deviceHash}`;
    } else {
      throw new ConvexError("Invalid anonymous device key.");
    }
    const now = Date.now();
    const recent = await ctx.db.query("uploadLog").withIndex("by_key_created", q => q.eq("key", key).gt("createdAt", now - 60 * 60 * 1000)).collect();
    if (recent.length >= 30) throw new ConvexError("Too many uploads. Please wait a little and try again.");
    await ctx.db.insert("uploadLog", { key, createdAt: now });
    return await ctx.storage.generateUploadUrl();
  },
});

export const createAnonymousReport = mutation({
  args: {
    deviceHash: v.string(), category, latitude: v.optional(v.number()), longitude: v.optional(v.number()),
    accuracyM: v.optional(v.number()), fallbackStationId: v.optional(v.id("stations")), media,
  },
  handler: async (ctx, args) => {
    if (args.deviceHash.length < 32 || args.deviceHash.length > 128) throw new ConvexError("Invalid anonymous device key.");
    if ((args.latitude === undefined) !== (args.longitude === undefined)) throw new ConvexError("Both coordinates are required.");
    if (args.latitude !== undefined && (args.latitude < -90 || args.latitude > 90 || args.longitude! < -180 || args.longitude! > 180)) throw new ConvexError("Invalid coordinates.");
    const now = Date.now();
    const recent = await ctx.db.query("reports").withIndex("by_device_created", q => q.eq("deviceHash", args.deviceHash)).order("desc").take(10);
    if (recent.filter(r => r.createdAt > now - 60 * 60 * 1000).length >= 5) throw new ConvexError("Please wait before sending more reports from this device.");
    if (args.media.length > 8) throw new ConvexError("Too many attachments.");
    for (const item of args.media) await validateMedia(ctx, item.storageId, item.kind);
    const station = await assignArea(ctx, args.latitude, args.longitude, args.fallbackStationId);
    const token = randomToken();
    let trackingCode = makeTrackingCode();
    for (let tries = 0; tries < 5 && await ctx.db.query("reports").withIndex("by_tracking_code", q => q.eq("trackingCode", trackingCode)).unique(); tries++) trackingCode = makeTrackingCode();
    const reportId = await ctx.db.insert("reports", {
      category: args.category, status: "received", trackingCode, followUpTokenHash: await tokenHash(token),
      deviceHash: args.deviceHash, latitude: args.latitude, longitude: args.longitude, accuracyM: args.accuracyM,
      stationId: station?._id, district: station?.district, subcounty: station?.subcounty, parish: station?.parish,
      verified: false, createdAt: now, updatedAt: now,
    });
    for (const item of args.media) await ctx.db.insert("reportMedia", { reportId, storageId: item.storageId, kind: item.kind, createdAt: now });
    await ctx.db.insert("reportUpdates", { reportId, toStatus: "received", note: "Report submitted", createdAt: now });
    return { reportId, trackingCode, token };
  },
});

export const publicStations = query({
  args: {},
  handler: async ctx => (await ctx.db.query("stations").collect()).filter(s => s.verified).sort((a,b) => a.name.localeCompare(b.name)),
});

export const trackAnonymous = query({
  args: { code: v.string(), token: v.string() },
  handler: async (ctx, args) => {
    const report = await ctx.db.query("reports").withIndex("by_tracking_code", q => q.eq("trackingCode", args.code.trim().toUpperCase())).unique();
    if (!report || report.followUpTokenHash !== await tokenHash(args.token)) return null;
    const updates = await ctx.db.query("reportUpdates").withIndex("by_report_created", q => q.eq("reportId", report._id)).order("asc").collect();
    const notes = await ctx.db.query("reportNotes").withIndex("by_report_created", q => q.eq("reportId", report._id)).order("asc").collect();
    const mediaItems = await ctx.db.query("reportMedia").withIndex("by_report_created", q => q.eq("reportId", report._id)).collect();
    const enrichedMedia = await Promise.all(mediaItems.map(async m => ({ ...m, url: await ctx.storage.getUrl(m.storageId) })));
    return { report: { _id: report._id, trackingCode: report.trackingCode, category: report.category, status: report.status, district: report.district, subcounty: report.subcounty, parish: report.parish, createdAt: report.createdAt, updatedAt: report.updatedAt }, updates, notes, media: enrichedMedia };
  },
});

export const addAnonymousNote = mutation({
  args: { code: v.string(), token: v.string(), body: v.optional(v.string()), storageId: v.optional(v.id("_storage")), kind: v.optional(v.union(v.literal("photo"), v.literal("voice"))) },
  handler: async (ctx, args) => {
    const report = await ctx.db.query("reports").withIndex("by_tracking_code", q => q.eq("trackingCode", args.code.trim().toUpperCase())).unique();
    if (!report || report.followUpTokenHash !== await tokenHash(args.token)) throw new ConvexError("Tracking code or secret token is invalid.");
    const body = args.body?.trim().slice(0, 3000);
    if (!body && !args.storageId) throw new ConvexError("Add a message or attachment.");
    const now = Date.now();
    const recentNotes = await ctx.db.query("reportNotes").withIndex("by_report_created", q => q.eq("reportId", report._id).gt("createdAt", now - 60 * 60 * 1000)).collect();
    if (recentNotes.filter(n => n.author === "citizen").length >= 20) throw new ConvexError("Too many updates. Please wait a little and try again.");
    if (args.storageId) await validateMedia(ctx, args.storageId, args.kind ?? "photo");
    await ctx.db.insert("reportNotes", { reportId: report._id, author: "citizen", body, storageId: args.storageId, createdAt: now });
    if (args.storageId && args.kind) await ctx.db.insert("reportMedia", { reportId: report._id, storageId: args.storageId, kind: args.kind, createdAt: now });
    await ctx.db.patch(report._id, { updatedAt: now });
    return { success: true };
  },
});

export const officerFeed = query({
  args: {
    district: v.optional(v.string()), subcounty: v.optional(v.string()), parish: v.optional(v.string()),
    category: v.optional(category), status: v.optional(status),
  },
  handler: async (ctx, args) => {
    const officer = await requireOfficer(ctx);
    const base = args.district
      ? await ctx.db.query("reports").withIndex("by_district_created", q => q.eq("district", args.district!)).order("desc").take(200)
      : officer.role === "admin" || officer.role === "super_admin"
        ? await ctx.db.query("reports").withIndex("by_created_at").order("desc").take(200)
        : officer.district
          ? await ctx.db.query("reports").withIndex("by_district_created", q => q.eq("district", officer.district!)).order("desc").take(200)
          : [];
    const rows = base.filter(r =>
      (officer.role === "admin" || officer.role === "super_admin" || r.district === officer.district) &&
      (!args.subcounty || r.subcounty === args.subcounty) && (!args.parish || r.parish === args.parish) &&
      (!args.category || r.category === args.category) && (!args.status || r.status === args.status)
    ).slice(0, 100);
    // Never send the device key or the follow-up token hash to officers.
    return await Promise.all(rows.map(async row => {
      const { deviceHash: _deviceHash, followUpTokenHash: _tokenHash, ...safe } = row;
      const mediaItems = await ctx.db.query("reportMedia").withIndex("by_report_created", q => q.eq("reportId", row._id)).collect();
      const noteItems = await ctx.db.query("reportNotes").withIndex("by_report_created", q => q.eq("reportId", row._id)).order("asc").collect();
      return {
        ...safe,
        media: await Promise.all(mediaItems.map(async m => ({ _id: m._id, kind: m.kind, url: await ctx.storage.getUrl(m.storageId) }))),
        notes: await Promise.all(noteItems.map(async n => ({ _id: n._id, author: n.author, body: n.body, createdAt: n.createdAt, url: n.storageId ? await ctx.storage.getUrl(n.storageId) : null }))),
      };
    }));
  },
});

export const officerAction = mutation({
  args: { reportId: v.id("reports"), action: v.union(v.literal("verify"), v.literal("assign_me"), v.literal("en_route"), v.literal("close"), v.literal("duplicate"), v.literal("false")), officerId: v.optional(v.id("userProfiles")) },
  handler: async (ctx, args) => {
    const actor = await requireOfficer(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("Report not found.");
    if (actor.role !== "admin" && actor.role !== "super_admin" && report.district !== actor.district) throw new ConvexError("Report is outside your district.");
    const now = Date.now();
    const nextStatus = args.action === "en_route" ? "en_route" : args.action === "close" ? "closed" : args.action === "duplicate" ? "duplicate" : args.action === "false" ? "false" : args.action === "assign_me" ? "assigned" : args.action === "verify" && report.status === "received" ? "seen" : report.status;
    let assignedOfficerId = report.assignedOfficerId;
    if (args.action === "assign_me") assignedOfficerId = actor._id;
    if (args.officerId) {
      const target = await ctx.db.get(args.officerId);
      if (!target || target.role !== "officer" || target.district !== report.district || target.stationId !== report.stationId) throw new ConvexError("Choose an active officer at this report's station.");
      assignedOfficerId = target._id;
    }
    await ctx.db.patch(report._id, { status: nextStatus, verified: args.action === "verify" ? true : report.verified, assignedOfficerId, updatedAt: now, ...(nextStatus === "closed" ? { closedAt: now } : {}) });
    await ctx.db.insert("reportUpdates", { reportId: report._id, actorId: actor._id, fromStatus: report.status, toStatus: nextStatus, note: args.action, createdAt: now });
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: `report.${args.action}`, entityType: "report", entityId: report._id, createdAt: now });
    return { success: true };
  },
});

export const replyToAnonymousReport = mutation({
  args: { reportId: v.id("reports"), body: v.string() },
  handler: async (ctx, args) => {
    const officer = await requireOfficer(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report || (officer.role !== "admin" && officer.role !== "super_admin" && report.district !== officer.district)) throw new ConvexError("Report not available.");
    const body = args.body.trim().slice(0, 3000);
    if (!body) throw new ConvexError("Reply cannot be empty.");
    const now = Date.now();
    await ctx.db.insert("reportNotes", { reportId: report._id, author: "officer", body, createdAt: now });
    await ctx.db.patch(report._id, { updatedAt: now });
    await ctx.db.insert("auditLogs", { actorId: officer._id, action: "report.reply", entityType: "report", entityId: report._id, createdAt: now });
    return { success: true };
  },
});
