import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOfficer } from "./lib/auth";
import { PRIORITY_TARGET_MIN } from "./reports";

const OPEN = new Set(["received", "seen", "assigned", "en_route"]);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Operational summary over the last `days` (default 30). Every officer can see all
 * districts or pick one.
 * Reads at most 2,000 recent reports — enough for a pilot; move to pre-aggregated
 * counters before national rollout.
 */
export const summary = query({
  args: { district: v.optional(v.string()), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOfficer(ctx);
    const district = args.district;
    const now = Date.now();
    const since = now - Math.min(Math.max(args.days ?? 30, 1), 365) * 86_400_000;
    const rows = district
      ? await ctx.db.query("reports").withIndex("by_district_created", q => q.eq("district", district).gte("createdAt", since)).order("desc").take(2000)
      : await ctx.db.query("reports").withIndex("by_created_at", q => q.gte("createdAt", since)).order("desc").take(2000);

    const overdue = (r: (typeof rows)[number]) =>
      OPEN.has(r.status) && !r.firstResponseAt && now - r.createdAt > PRIORITY_TARGET_MIN[r.priority ?? "p4"] * 60_000;
    const responseMin = rows.filter(r => r.firstResponseAt).map(r => (r.firstResponseAt! - r.createdAt) / 60_000);
    const resolveHrs = rows.filter(r => r.closedAt && r.status === "closed").map(r => (r.closedAt! - r.createdAt) / 3_600_000);

    const stations = await ctx.db.query("stations").collect();
    const stationName = new Map<string, string>(stations.map(s => [s._id as string, s.name]));
    type StationStats = { name: string; open: number; overdue: number; closed: number; total: number; response: number[] };
    const byStation = new Map<string, StationStats>();
    const byCategory = new Map<string, number>();
    const byParish = new Map<string, number>();
    for (const r of rows) {
      const key = (r.stationId as string | undefined) ?? "unrouted";
      const s: StationStats = byStation.get(key) ?? { name: stationName.get(key) ?? "Not routed", open: 0, overdue: 0, closed: 0, total: 0, response: [] };
      s.total++;
      if (OPEN.has(r.status)) s.open++; else s.closed++;
      if (overdue(r)) s.overdue++;
      if (r.firstResponseAt) s.response.push((r.firstResponseAt - r.createdAt) / 60_000);
      byStation.set(key, s);
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
      const place = [r.parish, r.subcounty, r.district].filter(Boolean).join(", ") || "Location unknown";
      byParish.set(place, (byParish.get(place) ?? 0) + 1);
    }
    const desc = <T,>(m: Map<string, T>, f: (t: T) => number) => [...m.entries()].sort((a, b) => f(b[1]) - f(a[1]));

    return {
      scope: district ?? "All districts",
      days: Math.round((now - since) / 86_400_000),
      capped: rows.length === 2000,
      totals: {
        received: rows.length,
        open: rows.filter(r => OPEN.has(r.status)).length,
        overdue: rows.filter(overdue).length,
        p1Open: rows.filter(r => OPEN.has(r.status) && r.priority === "p1").length,
        closed: rows.filter(r => r.status === "closed").length,
        rejected: rows.filter(r => r.status === "false" || r.status === "duplicate").length,
        medianResponseMin: median(responseMin),
        medianResolveHrs: median(resolveHrs),
      },
      stations: desc(byStation, s => s.open).map(([, s]) => ({ name: s.name, open: s.open, overdue: s.overdue, closed: s.closed, total: s.total, medianResponseMin: median(s.response) })),
      categories: desc(byCategory, n => n).map(([category, count]) => ({ category, count })),
      hotspots: desc(byParish, n => n).slice(0, 10).map(([place, count]) => ({ place, count })),
      districts: (await ctx.db.query("adminAreas").withIndex("by_level_district", q => q.eq("level", "district")).collect()).map(d => d.district).sort(),
    };
  },
});
