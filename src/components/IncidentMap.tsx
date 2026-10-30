"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery } from "convex/react";
import { MapPin } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { directionsUrl } from "@/components/stationLinks";

const StationMap = dynamic(() => import("@/components/StationMap"), { ssr: false, loading: () => <p className="p-4 text-sm text-slate-600">Loading map…</p> });

/** Incident location with the nearest verified stations. Stations are only fetched once the panel is opened. */
export default function IncidentMap({ lat, lng }: { lat: number; lng: number }) {
  const [open, setOpen] = useState(false);
  const stations = useQuery(api.geo.nearestStations, open ? { lat, lng, limit: 5 } : "skip");
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="rounded border border-slate-200">
    <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold"><MapPin size={14} aria-hidden="true" />Map and nearest stations</summary>
    {open && <div className="space-y-2 px-3 pb-3">
      <StationMap stations={stations ?? []} center={[lat, lng]} zoom={13} you={[lat, lng]} height={300} />
      <p className="text-xs text-slate-600">Blue dot: reported location. <a className="text-blue-800 underline" href={directionsUrl(lat, lng)} target="_blank" rel="noreferrer">Directions to the incident</a></p>
      {stations && stations.length === 0 && <p className="text-sm text-slate-600">No verified stations yet. A super-admin can verify imported stations.</p>}
      <ul className="divide-y divide-slate-100 text-sm">{stations?.map(s => <li key={s._id} className="flex items-center justify-between gap-2 py-1.5">
        <span className="min-w-0 truncate">{s.name} <span className="text-xs text-slate-500">· {s.distanceKm.toFixed(1)} km{s.phone ? ` · ${s.phone}` : ""}</span></span>
        <a className="shrink-0 text-blue-800 underline" href={`https://www.google.com/maps/dir/?api=1&origin=${s.lat},${s.lng}&destination=${lat},${lng}&travelmode=driving`} target="_blank" rel="noreferrer">Route to scene</a>
      </li>)}</ul>
    </div>}
  </details>;
}
