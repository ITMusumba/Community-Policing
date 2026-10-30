// Builds Uganda admin-area data (district > subcounty > parish) from the UBOS parish shapefile.
// Source: HDX "Uganda administrative boundaries as of 17-08-2018" (UBOS, public domain).
// Usage: node scripts/build-admin-data.mjs <path-to-PARISHES_2016_UTM_36N.shp>
// Output: data/admin/areas.jsonl and data/admin/geo.jsonl, loaded with:
//   npx convex import --table adminAreas --replace data/admin/areas.jsonl
//   npx convex import --table adminGeo --replace data/admin/geo.jsonl
import * as shapefile from "shapefile";
import proj4 from "proj4";
import { mkdirSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) { console.error("Usage: node scripts/build-admin-data.mjs <PARISHES_2016_UTM_36N.shp>"); process.exit(1); }

// Arc 1960 / UTM 36N -> WGS84 (3-parameter East Africa shift).
const toWgs84 = proj4("+proj=utm +zone=36 +a=6378249.145 +rf=293.465 +towgs84=-160,-8,-300,0,0,0,0 +units=m +no_defs", "EPSG:4326");
const TOLERANCE_DEG = 0.0004; // ~40 m
const MAX_PART_BYTES = 800_000; // Convex documents are limited to 1 MiB

function titleCase(s) {
  return String(s ?? "").trim().toLowerCase().replace(/(^|[\s\-'(])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\s+/g, " ");
}
const round = (n) => Math.round(n * 1e4) / 1e4;

function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (!len) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplify(points, tol) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let max = 0, idx = -1;
    for (let k = i + 1; k < j; k++) { const d = perpDist(points[k], points[i], points[j]); if (d > max) { max = d; idx = k; } }
    if (max > tol) { keep[idx] = 1; stack.push([i, idx], [idx, j]); }
  }
  return points.filter((_, i) => keep[i]);
}
const project = (pt) => toWgs84.forward(pt);
function buildRings(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const result = [];
  for (const poly of polys) {
    const rings = [];
    for (const ring of poly) {
      const simplified = simplify(ring.map(project), TOLERANCE_DEG).map(([x, y]) => [round(x), round(y)]);
      if (simplified.length >= 4) rings.push(simplified);
    }
    if (rings.length) result.push(rings);
  }
  return result;
}
function bboxOf(polys) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const poly of polys) for (const [x, y] of poly[0]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return [minX, minY, maxX, maxY];
}

const source = await shapefile.open(input);
const districts = new Map(); // district -> parish features
let total = 0;
for (;;) {
  const { done, value } = await source.read();
  if (done) break;
  const p = value.properties;
  const district = titleCase(p.DName2016), subcounty = titleCase(p.SName2016), parish = titleCase(p.PName2016), county = titleCase(p.CName2016);
  if (!district || !value.geometry) continue;
  const polys = buildRings(value.geometry);
  if (!polys.length) continue;
  const bbox = bboxOf(polys);
  if (!districts.has(district)) districts.set(district, []);
  districts.get(district).push({ county, subcounty, parish, bbox, polys });
  total++;
}

const areas = [];
const geo = [];
for (const [district, list] of [...districts].sort((a, b) => a[0].localeCompare(b[0]))) {
  const dBox = list.reduce((acc, f) => [Math.min(acc[0], f.bbox[0]), Math.min(acc[1], f.bbox[1]), Math.max(acc[2], f.bbox[2]), Math.max(acc[3], f.bbox[3])], [180, 90, -180, -90]);
  areas.push({ level: "district", district, bbox: dBox, lat: round((dBox[1] + dBox[3]) / 2), lng: round((dBox[0] + dBox[2]) / 2) });
  const seenSub = new Set();
  for (const f of list) {
    const key = `${f.county}|${f.subcounty}`;
    if (!seenSub.has(key)) { seenSub.add(key); areas.push({ level: "subcounty", district, county: f.county, subcounty: f.subcounty }); }
    areas.push({ level: "parish", district, county: f.county, subcounty: f.subcounty, parish: f.parish, bbox: f.bbox, lat: round((f.bbox[1] + f.bbox[3]) / 2), lng: round((f.bbox[0] + f.bbox[2]) / 2) });
  }
  // Split polygons into parts below the Convex document limit.
  let part = 0, current = [], size = 0;
  const flush = () => { if (current.length) { geo.push({ district, part: part++, features: JSON.stringify(current) }); current = []; size = 0; } };
  for (const f of list) {
    const feature = { s: f.subcounty, p: f.parish, b: f.bbox, g: f.polys };
    const bytes = JSON.stringify(feature).length;
    if (size + bytes > MAX_PART_BYTES) flush();
    current.push(feature); size += bytes;
  }
  flush();
}

mkdirSync("data/admin", { recursive: true });
writeFileSync("data/admin/areas.jsonl", areas.map((a) => JSON.stringify(a)).join("\n") + "\n");
writeFileSync("data/admin/geo.jsonl", geo.map((g) => JSON.stringify(g)).join("\n") + "\n");
const geoBytes = geo.reduce((n, g) => n + g.features.length, 0);
console.log(`districts=${districts.size} parishes=${total} areas=${areas.length} geoParts=${geo.length} geoMB=${(geoBytes / 1e6).toFixed(1)}`);
