"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { directionsUrl } from "@/components/stationLinks";

const StationMap = dynamic(() => import("@/components/StationMap"), { ssr: false, loading: () => <p className="p-6">Loading map…</p> });
const UGANDA_CENTER: [number, number] = [1.37, 32.29];
const typeLabel: Record<string, string> = { headquarters: "Headquarters", regional_hq: "Regional HQ", district_hq: "District HQ", station: "Station", post: "Post", community_policing_point: "Community point" };

export default function StationsPage() {
  const stations = useQuery(api.reports.publicStations, {});
  const [search, setSearch] = useState("");
  const [you, setYou] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState("");
  const nearest = useQuery(api.geo.nearestStations, you ? { lat: you[0], lng: you[1], limit: 5 } : "skip");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stations ?? []).filter(s => !q || `${s.name} ${s.district} ${s.subcounty}`.toLowerCase().includes(q));
  }, [stations, search]);
  const shown = you && nearest && !search.trim() ? nearest : filtered;
  const center = you ?? (shown.length === 1 ? [shown[0].lat, shown[0].lng] as [number, number] : UGANDA_CENTER);
  const zoom = you ? 11 : shown.length === 1 ? 14 : 7;

  function locateMe() {
    setGeoError("");
    if (!navigator.geolocation) { setGeoError("Location is not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(p => setYou([p.coords.latitude, p.coords.longitude]), () => setGeoError("Could not get your location. Search by name or district instead."), { enableHighAccuracy: true, timeout: 8000 });
  }

  return <main className="mx-auto min-h-screen max-w-3xl bg-slate-50 p-4 text-[#102a43] sm:p-6">
    <a href="/" className="text-sm font-bold underline">← Home</a>
    <h1 className="mt-3 text-2xl font-black">Find a police station</h1>
    <p className="mt-1 text-sm text-slate-600">Verified stations and posts. In an emergency call 999 or 112.</p>
    <div className="mt-4 flex gap-2">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search station, district or subcounty" className="min-h-12 flex-1 rounded-xl border bg-white p-3" />
      <button onClick={locateMe} className="min-h-12 rounded-xl bg-[#176b87] px-4 font-bold text-white">📍 Near me</button>
    </div>
    {geoError && <p role="alert" className="mt-2 text-sm text-red-700">{geoError}</p>}
    <div className="mt-4 overflow-hidden rounded-2xl border bg-white"><StationMap stations={shown.slice(0, 300)} center={center} zoom={zoom} you={you} /></div>
    {stations === undefined ? <p className="mt-4">Loading stations…</p> : <ul className="mt-4 space-y-2">
      {shown.slice(0, 50).map(s => <li key={s._id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
        <div><p className="font-bold">{s.name}</p><p className="text-xs text-slate-500">{typeLabel[s.type] ?? s.type} · {s.district}{"distanceKm" in s ? ` · ${(s as { distanceKm: number }).distanceKm.toFixed(1)} km` : ""}</p>{s.phone && <a href={`tel:${s.phone}`} className="text-sm underline">{s.phone}</a>}</div>
        <a href={directionsUrl(s.lat, s.lng)} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-[#102a43] px-3 py-2 text-sm font-bold text-white">Directions ↗</a>
      </li>)}
      {shown.length === 0 && <li className="rounded-xl bg-white p-4 text-sm">No verified stations match. Stations appear here once an administrator approves them.</li>}
    </ul>}
  </main>;
}
