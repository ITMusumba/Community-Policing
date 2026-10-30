import type { QueryCtx } from "../_generated/server";

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Ring = number[][];
type ParishFeature = { s: string; p: string; b: number[]; g: Ring[][] };
export type AreaMatch = { district: string; subcounty: string; parish: string };

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function inPolygon(x: number, y: number, polygon: Ring[]) {
  if (!inRing(x, y, polygon[0])) return false;
  return !polygon.slice(1).some(hole => inRing(x, y, hole));
}

/**
 * Resolves a GPS point to district/subcounty/parish using the simplified UBOS parish polygons in `adminGeo`.
 * Polygons are simplified (~40 m), so a point in a sliver or on a lake edge falls back to the nearest parish
 * centre within 3 km. Returns null when no area data is loaded or the point is outside every district.
 */
export async function locatePoint(ctx: Pick<QueryCtx, "db">, lat: number, lng: number): Promise<AreaMatch | null> {
  const districts = await ctx.db.query("adminAreas").withIndex("by_level_district", q => q.eq("level", "district")).collect();
  const margin = 0.03;
  const candidates = districts.filter(d => d.bbox && lng >= d.bbox[0] - margin && lng <= d.bbox[2] + margin && lat >= d.bbox[1] - margin && lat <= d.bbox[3] + margin);
  let nearest: { match: AreaMatch; km: number } | null = null;
  for (const district of candidates) {
    const parts = await ctx.db.query("adminGeo").withIndex("by_district", q => q.eq("district", district.district)).collect();
    for (const part of parts) {
      for (const f of JSON.parse(part.features) as ParishFeature[]) {
        if (lng < f.b[0] - margin || lng > f.b[2] + margin || lat < f.b[1] - margin || lat > f.b[3] + margin) continue;
        const match = { district: district.district, subcounty: f.s, parish: f.p };
        if (f.g.some(polygon => inPolygon(lng, lat, polygon))) return match;
        const km = distanceKm(lat, lng, (f.b[1] + f.b[3]) / 2, (f.b[0] + f.b[2]) / 2);
        if (!nearest || km < nearest.km) nearest = { match, km };
      }
    }
  }
  return nearest && nearest.km <= 3 ? nearest.match : null;
}
