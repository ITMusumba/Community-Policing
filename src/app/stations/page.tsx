"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { directionsUrl } from "@/components/stationLinks";

const StationMap = dynamic(() => import("@/components/StationMap"), { ssr: false, loading: () => <p className="p-6">Loading map…</p> });
const UGANDA_CENTER: [number, number] = [1.37, 32.29];
const typeLabel: Record<string, string> = { headquarters: "Headquarters", regional_hq: "Regional HQ", district_hq: "District HQ", station: "Station", post: "Post", community_policing_point: "Community point" };
type Focus = { lat: number; lng: number; label: string; zoom: number; mine?: boolean };
type Suggestion = { key: string; label: string; detail: string; lat: number; lng: number; zoom: number };

export default function StationsPage() {
  const stations = useQuery(api.reports.publicStations, {});
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [geoError, setGeoError] = useState("");

  // Wait for a short pause in typing before asking the server for place names.
  useEffect(() => { const t = setTimeout(() => setQuery(text.trim()), 250); return () => clearTimeout(t); }, [text]);
  const places = useQuery(api.geo.searchPlaces, query.length >= 2 ? { text: query } : "skip");
  const nearest = useQuery(api.geo.nearestStations, focus ? { lat: focus.lat, lng: focus.lng, limit: 10 } : "skip");

  const suggestions: Suggestion[] = useMemo(() => {
    const q = query.toLowerCase();
    if (q.length < 2) return [];
    const stationHits = (stations ?? []).filter(s => s.name.toLowerCase().includes(q)).slice(0, 5)
      .map(s => ({ key: s._id, label: s.name, detail: `${typeLabel[s.type] ?? "Station"} · ${s.district}`, lat: s.lat, lng: s.lng, zoom: 15 }));
    const placeHits = (places ?? []).map(p => ({ key: `${p.kind}:${p.label}:${p.detail}`, label: p.label, detail: p.detail, lat: p.lat, lng: p.lng, zoom: p.kind === "district" ? 11 : p.kind === "subcounty" ? 13 : 14 }));
    return [...stationHits, ...placeHits];
  }, [query, stations, places]);

  function choose(s: Suggestion) {
    setText(s.label);
    setOpen(false);
    setFocus({ lat: s.lat, lng: s.lng, label: s.label, zoom: s.zoom });
  }

  function locateMe() {
    setGeoError("");
    if (!navigator.geolocation) { setGeoError("Location is not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(
      p => { setText(""); setFocus({ lat: p.coords.latitude, lng: p.coords.longitude, label: "your location", zoom: 13, mine: true }); },
      () => setGeoError("Could not get your location. Type a place name instead."),
      { enableHighAccuracy: true, timeout: 8000 });
  }

  const listed = focus ? nearest ?? [] : [];
  const center: [number, number] = focus ? [focus.lat, focus.lng] : UGANDA_CENTER;

  return <main className="mx-auto min-h-screen max-w-3xl p-4 text-[#102a43] sm:p-6">
    <a href="/" className="text-sm font-bold underline">← Home</a>
    <h1 className="mt-3 text-2xl font-black">Find a police station</h1>
    <p className="mt-1 text-sm text-slate-600">Type a station, district, subcounty or parish. In an emergency call 999 or 112.</p>
    <div className="mt-4 flex gap-2">
      <div className="relative flex-1">
        <input value={text} onChange={e => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => { if (e.key === "Enter" && suggestions[0]) choose(suggestions[0]); if (e.key === "Escape") setOpen(false); }}
          role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls="place-suggestions" aria-autocomplete="list"
          placeholder="e.g. Bugolobi, Kamuli, Central Police" className="min-h-12 w-full rounded-xl border bg-white p-3" />
        {open && suggestions.length > 0 && <ul id="place-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {suggestions.map(s => <li key={s.key} role="option" aria-selected={false}>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(s)} className="block w-full px-3 py-2 text-left hover:bg-slate-50">
              <span className="block font-semibold">{s.label}</span><span className="block text-xs text-slate-500">{s.detail}</span>
            </button>
          </li>)}
        </ul>}
        {open && query.length >= 2 && places !== undefined && suggestions.length === 0 && <p className="absolute left-0 right-0 top-full z-[1000] mt-1 rounded-xl border bg-white p-3 text-sm shadow-lg">No matching place or station.</p>}
      </div>
      <button onClick={locateMe} className="min-h-12 shrink-0 rounded-xl bg-[#176b87] px-4 font-bold text-white">📍 Near me</button>
    </div>
    {geoError && <p role="alert" className="mt-2 text-sm text-red-700">{geoError}</p>}
    <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
      <StationMap stations={stations ?? []} center={center} zoom={focus?.zoom ?? 7} you={focus?.mine ? [focus.lat, focus.lng] : null} />
    </div>
    <p className="mt-2 text-xs text-slate-500">📍 Confirmed station · faded 📍 from OpenStreetMap, not yet confirmed by police administrators.</p>
    {stations === undefined && <p className="mt-4">Loading stations…</p>}
    {!focus && stations && <p className="mt-4 rounded-xl bg-white p-4 text-sm">Search for a place or tap <strong>Near me</strong> to list the closest stations with directions.</p>}
    {focus && <section className="mt-4"><h2 className="font-black">Nearest to {focus.label}</h2>
      <ul className="mt-2 space-y-2">{listed.map(s => <li key={s._id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
        <div className="min-w-0"><p className="font-bold">{s.name}</p><p className="text-xs text-slate-500">{typeLabel[s.type] ?? s.type} · {s.district} · {s.distanceKm.toFixed(1)} km{s.verified ? "" : " · unconfirmed"}</p>{s.phone && <a href={`tel:${s.phone}`} className="text-sm underline">{s.phone}</a>}</div>
        <a href={directionsUrl(s.lat, s.lng)} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-[#102a43] px-3 py-2 text-sm font-bold text-white">Directions ↗</a>
      </li>)}
      {nearest && listed.length === 0 && <li className="rounded-xl bg-white p-4 text-sm">No stations loaded yet.</li>}</ul>
    </section>}
  </main>;
}
