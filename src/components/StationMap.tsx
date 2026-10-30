"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { directionsUrl } from "./stationLinks";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

export type MapStation = { _id: string; name: string; type: string; lat: number; lng: number; phone?: string; district: string; verified?: boolean; distanceKm?: number };

const icon = L.divIcon({ className: "", html: '<div style="font-size:26px;line-height:26px">📍</div>', iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
// Imported, not yet confirmed by an administrator: same pin, faded.
const unconfirmedIcon = L.divIcon({ className: "", html: '<div style="font-size:22px;line-height:22px;opacity:.55">📍</div>', iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20] });

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const [lat, lng] = center;
  // Depend on the numbers, not the array, so panning by hand is not undone on every render.
  useEffect(() => { map.setView([lat, lng], zoom); }, [map, lat, lng, zoom]);
  return null;
}

export default function StationMap({ stations, center, zoom, you, height = 420 }: {
  stations: MapStation[]; center: [number, number]; zoom: number; you?: [number, number] | null; height?: number;
}) {
  return <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height, width: "100%", borderRadius: 16 }}>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <Recenter center={center} zoom={zoom} />
    {you && <CircleMarker center={you} radius={9} pathOptions={{ color: "#176b87", fillColor: "#176b87", fillOpacity: 0.8 }}><Popup>You are here</Popup></CircleMarker>}
    {stations.map(s => <Marker key={s._id} position={[s.lat, s.lng]} icon={s.verified === false ? unconfirmedIcon : icon}>
      <Popup>
        <strong>{s.name}</strong><br />{s.district}{s.distanceKm !== undefined ? ` · ${s.distanceKm.toFixed(1)} km away` : ""}
        {s.verified === false && <><br /><em>Location from OpenStreetMap, not yet confirmed</em></>}
        {s.phone && <><br /><a href={`tel:${s.phone}`}>{s.phone}</a></>}
        <br /><a href={directionsUrl(s.lat, s.lng)} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>Get directions ↗</a>
      </Popup>
    </Marker>)}
  </MapContainer>;
}
