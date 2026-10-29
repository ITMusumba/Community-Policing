import { internalMutation } from "./_generated/server";

// Run manually from the Convex dashboard: internal.seed.seedStations
export const seedStations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("stations").collect();
    if (existing.length) return { inserted: 0, message: "Stations already exist; seed skipped." };
    const stations = [
      { name: "Central Police Station", type: "station" as const, lat: 0.3136, lng: 32.5811, district: "Kampala", subcounty: "Central Division", parish: "Kampala Central" },
      { name: "Kira Road Police Station", type: "station" as const, lat: 0.3476, lng: 32.5938, district: "Kampala", subcounty: "Kawempe Division", parish: "Bukoto" },
      { name: "Wandegeya Police Station", type: "station" as const, lat: 0.3375, lng: 32.5684, district: "Kampala", subcounty: "Kawempe Division", parish: "Wandegeya" },
      { name: "Jinja Road Police Station", type: "station" as const, lat: 0.3139, lng: 32.5973, district: "Kampala", subcounty: "Nakawa Division", parish: "Nakawa" },
      { name: "Katwe Police Station", type: "station" as const, lat: 0.2917, lng: 32.5685, district: "Kampala", subcounty: "Makindye Division", parish: "Katwe" },
      { name: "Kabalagala Police Station", type: "station" as const, lat: 0.2947, lng: 32.6121, district: "Kampala", subcounty: "Makindye Division", parish: "Kabalagala" },
      { name: "Old Kampala Police Station", type: "station" as const, lat: 0.3167, lng: 32.5678, district: "Kampala", subcounty: "Lubaga Division", parish: "Old Kampala" },
      { name: "Kamuli Central Police Station", type: "station" as const, lat: 0.9472, lng: 33.1197, district: "Kamuli", subcounty: "Northern Division", parish: "Kamuli Central" },
      { name: "Nawanyago Police Post", type: "post" as const, lat: 0.8854, lng: 33.1884, district: "Kamuli", subcounty: "Nawanyago", parish: "Nawanyago" },
      { name: "Bugulumbya Police Post", type: "post" as const, lat: 0.9804, lng: 33.1967, district: "Kamuli", subcounty: "Bugulumbya", parish: "Bugulumbya" },
    ];
    for (const station of stations) await ctx.db.insert("stations", { ...station, verified: true });
    return { inserted: stations.length };
  },
});
