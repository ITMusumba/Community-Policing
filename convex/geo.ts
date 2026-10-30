import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { distanceKm, locatePoint } from "./lib/geo";

export const districts = query({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("adminAreas").withIndex("by_level_district", q => q.eq("level", "district")).collect();
    return rows.map(r => r.district).sort((a, b) => a.localeCompare(b));
  },
});

export const subcounties = query({
  args: { district: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("adminAreas")
      .withIndex("by_level_district", q => q.eq("level", "subcounty").eq("district", args.district)).collect();
    return [...new Set(rows.map(r => r.subcounty!))].sort((a, b) => a.localeCompare(b));
  },
});

export const parishes = query({
  args: { district: v.string(), subcounty: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("adminAreas")
      .withIndex("by_level_district_subcounty", q => q.eq("level", "parish").eq("district", args.district).eq("subcounty", args.subcounty)).collect();
    return rows.map(r => r.parish!).sort((a, b) => a.localeCompare(b));
  },
});

/** District/subcounty/parish for a GPS point, or null when outside the loaded boundaries. */
export const locate = query({
  args: { lat: v.number(), lng: v.number() },
  handler: async (ctx, args) => await locatePoint(ctx, args.lat, args.lng),
});

/** Verified stations closest to a point, with straight-line distance in km. */
export const nearestStations = query({
  args: { lat: v.number(), lng: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const stations = (await ctx.db.query("stations").collect()).filter(s => s.verified);
    return stations
      .map(s => ({ ...s, distanceKm: distanceKm(args.lat, args.lng, s.lat, s.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, Math.min(Math.max(args.limit ?? 5, 1), 25));
  },
});

/**
 * One-off backfill: reports that have GPS but no district. Run repeatedly until `remaining` is 0:
 *   npx convex run geo:backfillReportAreas
 */
export const backfillReportAreas = internalMutation({
  args: {},
  handler: async ctx => {
    const batch = await ctx.db.query("reports").withIndex("by_created_at").order("desc")
      .filter(q => q.and(q.eq(q.field("district"), undefined), q.neq(q.field("latitude"), undefined))).take(25);
    let updated = 0;
    for (const report of batch) {
      const area = await locatePoint(ctx, report.latitude!, report.longitude!);
      if (area) { await ctx.db.patch(report._id, area); updated++; }
    }
    return { scanned: batch.length, updated, remaining: batch.length - updated };
  },
});

function stationType(name: string) {
  if (/regional/i.test(name)) return "regional_hq" as const;
  if (/district.*(hq|hqtrs|headquarter)|\bdpc\b/i.test(name)) return "district_hq" as const;
  if (/police.*(hq|hqtrs|headquarter)|(hq|headquarter).*police/i.test(name)) return "headquarters" as const;
  if (/post/i.test(name)) return "post" as const;
  return "station" as const;
}

/**
 * Imports OpenStreetMap police features (scripts/import-osm-police.mjs). New rows are unverified, so they stay out of
 * public lists until a super admin approves them. Existing osmIds are skipped.
 */
export const importOsmStations = internalMutation({
  args: {
    items: v.array(v.object({
      osmId: v.string(), name: v.string(), lat: v.number(), lng: v.number(), phone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let inserted = 0, skipped = 0, noArea = 0;
    for (const item of args.items) {
      const existing = await ctx.db.query("stations").withIndex("by_osm_id", q => q.eq("osmId", item.osmId)).unique();
      if (existing) { skipped++; continue; }
      const area = await locatePoint(ctx, item.lat, item.lng);
      if (!area) noArea++;
      await ctx.db.insert("stations", {
        name: item.name, type: stationType(item.name), lat: item.lat, lng: item.lng, phone: item.phone,
        district: area?.district ?? "Unknown", subcounty: area?.subcounty ?? "Unknown", parish: area?.parish ?? "Unknown",
        verified: false, source: "osm", osmId: item.osmId,
      });
      inserted++;
    }
    return { inserted, skipped, noArea };
  },
});

/** Removes imported OSM stations that nobody has approved yet (so the import can be re-run after tweaking filters). */
export const clearUnverifiedOsmStations = internalMutation({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("stations").collect();
    let removed = 0;
    for (const row of rows) if (row.source === "osm" && !row.verified) { await ctx.db.delete(row._id); removed++; }
    return { removed };
  },
});
