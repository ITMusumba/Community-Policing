// Imports Uganda police stations from OpenStreetMap (ODbL) into the `stations` table as UNVERIFIED rows.
// Usage: node scripts/import-osm-police.mjs [--prod]
// A super admin then approves rows on /super-admin before they appear publicly.
import { execFileSync } from "node:child_process";

const prod = process.argv.includes("--prod");
const query = '[out:json][timeout:120];area["ISO3166-1"="UG"][admin_level=2]->.a;(nwr["amenity"="police"](area.a););out center tags;';
let res;
for (let attempt = 1; attempt <= 4; attempt++) {
  res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "User-Agent": "CommunityPolicingUG/0.1 (station import)", "Content-Type": "application/x-www-form-urlencoded", Accept: "*/*" },
  body: "data=" + encodeURIComponent(query),
  });
  if (res.ok) break;
  console.log(`Overpass returned ${res.status}, retrying…`);
  await new Promise((r) => setTimeout(r, attempt * 5000));
}
if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
const { elements } = await res.json();

const items = elements
  .filter((e) => e.tags?.name && (e.lat ?? e.center?.lat) !== undefined && !/(UWA|wildlife|workshop|barracks|military|army|\bcoy\b|\bhouse\b|\bUPDF\b|training school|college)/i.test(e.tags.name))
  .map((e) => ({
    osmId: `${e.type}/${e.id}`,
    name: e.tags.name.trim().slice(0, 160),
    lat: e.lat ?? e.center.lat,
    lng: e.lon ?? e.center.lon,
    ...((e.tags.phone || e.tags["contact:phone"]) ? { phone: String(e.tags.phone || e.tags["contact:phone"]).slice(0, 40) } : {}),
  }));
console.log(`${items.length} named police features from OSM`);

const totals = { inserted: 0, skipped: 0, noArea: 0 };
for (let i = 0; i < items.length; i += 40) {
  const cmd = `npx convex run ${prod ? "--prod " : ""}geo:importOsmStations "$ARGS"`;
  let out;
  for (let attempt = 1; ; attempt++) {
    try { out = execFileSync("bash", ["-c", cmd], { encoding: "utf8", env: { ...process.env, ARGS: JSON.stringify({ items: items.slice(i, i + 40) }) } }); break; }
    catch (e) { if (attempt >= 4) throw e; console.log(`Batch failed, retrying (${attempt})…`); await new Promise((r) => setTimeout(r, 3000)); }
  }
  const r = JSON.parse(out.slice(out.indexOf("{")));
  for (const k of Object.keys(totals)) totals[k] += r[k];
}
console.log(totals);
