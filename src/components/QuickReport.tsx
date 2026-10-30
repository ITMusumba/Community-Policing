"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { copy, type Language } from "@/lib/i18n";

const categories = [
  ["🚲", "theft"], ["🔫", "robbery"], ["🩹", "assault"], ["🏠", "domestic_violence"],
  ["🛑", "sexual_violence"], ["🚗", "accident"], ["🔥", "fire"], ["💊", "drugs"],
  ["👁️", "suspicious_activity"], ["🐄", "livestock_theft"], ["🏡", "land_property_dispute"], ["❔", "other"],
] as const;
type Category = typeof categories[number][1];
type MediaItem = { storageId: string; kind: "photo" | "video" | "voice" };
type Pending = { deviceHash: string; category: Category; latitude?: number; longitude?: number; accuracyM?: number; fallbackStationId?: string; media: MediaItem[] };

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("community-policing-queue", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("reports", { autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function queueReport(report: Pending) {
  const db = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("reports", "readwrite").objectStore("reports").add(report);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}
async function hashDeviceId() {
  let id = localStorage.getItem("cp-device-id");
  if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("cp-device-id", id); }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function compressImage(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing unavailable.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not compress photo")), "image/jpeg", 0.7));
}

export default function QuickReport() {
  const [language, setLanguage] = useState<Language>("en");
  const [category, setCategory] = useState<Category>("other");
  const [files, setFiles] = useState<File[]>([]);
  const [voice, setVoice] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number; accuracyM: number } | null>(null);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [stationId, setStationId] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ trackingCode: string; token: string } | null>(null);
  const stations = useQuery(api.reports.publicStations, {});
  const generateUploadUrl = useMutation(api.reports.generateUploadUrl);
  const createReport = useMutation(api.reports.createAnonymousReport);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const t = copy[language];

  useEffect(() => {
    if (!navigator.geolocation) { setGpsFailed(true); return; }
    navigator.geolocation.getCurrentPosition(p => setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy }), () => setGpsFailed(true), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
  }, []);

  async function upload(blob: Blob, kind: MediaItem["kind"]) {
    const url = await generateUploadUrl({ deviceHash: await hashDeviceId() });
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type || (kind === "voice" ? "audio/webm" : "application/octet-stream") }, body: blob });
    if (!response.ok) throw new Error("Upload failed");
    return { storageId: (await response.json()).storageId as string, kind };
  }
  async function submit(payload?: Pending) {
    setSending(true); setError(""); setWaiting(false);
    try {
      let pending = payload;
      if (!pending) {
        const uploaded: MediaItem[] = [];
        for (const file of files) uploaded.push(await upload(file.type.startsWith("image/") ? await compressImage(file) : file, file.type.startsWith("video/") ? "video" : "photo"));
        if (voice) uploaded.push(await upload(voice, "voice"));
        pending = { deviceHash: await hashDeviceId(), category, latitude: position?.latitude, longitude: position?.longitude, accuracyM: position?.accuracyM, fallbackStationId: stationId || undefined, media: uploaded };
      }
      if (!navigator.onLine) { await queueReport(pending); setWaiting(true); return; }
      const created = await createReport(pending as Parameters<typeof createReport>[0]);
      localStorage.setItem(`cp-track-${created.trackingCode}`, created.token);
      setResult(created);
      window.history.replaceState({}, "", `/track?code=${encodeURIComponent(created.trackingCode)}`);
      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(created.trackingCode.split("").join(" ")));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not send";
      if (!navigator.onLine || /network|fetch|upload failed/i.test(message)) {
        try {
          const pending: Pending = { deviceHash: await hashDeviceId(), category, latitude: position?.latitude, longitude: position?.longitude, accuracyM: position?.accuracyM, fallbackStationId: stationId || undefined, media: [] };
          await queueReport(pending); setWaiting(true);
        } catch { setError(message); }
      } else setError(message);
    } finally { setSending(false); }
  }
  useEffect(() => {
    const retry = async () => {
      try {
        const db = await openQueue();
        const items = await new Promise<{ key: IDBValidKey; value: Pending }[]>((resolve, reject) => {
          const request = db.transaction("reports").objectStore("reports").openCursor();
          const rows: { key: IDBValidKey; value: Pending }[] = [];
          request.onsuccess = () => { const cursor = request.result; if (cursor) { rows.push({ key: cursor.key, value: cursor.value }); cursor.continue(); } else resolve(rows); };
          request.onerror = () => reject(request.error);
        });
        for (const item of items) {
          try {
            const created = await createReport(item.value as Parameters<typeof createReport>[0]);
            localStorage.setItem(`cp-track-${created.trackingCode}`, created.token);
            await new Promise<void>((resolve, reject) => { const request = db.transaction("reports", "readwrite").objectStore("reports").delete(item.key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
          } catch { break; }
        }
      } catch { /* queue remains for next online event */ }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [createReport]);

  async function toggleVoice() {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream); const chunks: BlobPart[] = [];
      rec.ondataavailable = event => chunks.push(event.data);
      rec.onstop = () => { setVoice(new Blob(chunks, { type: rec.mimeType || "audio/webm" })); stream.getTracks().forEach(track => track.stop()); };
      recorder.current = rec; rec.start(); setRecording(true);
    } catch { setError("Microphone permission is unavailable."); }
  }

  if (result) return <main className="min-h-screen bg-[#102a43] p-6 text-center text-white flex flex-col items-center justify-center">
    <div className="text-7xl" aria-hidden="true">✅</div><p className="mt-6 text-xl">{t.submitted}</p>
    <p className="mt-3 text-4xl font-black tracking-widest sm:text-6xl">{result.trackingCode}</p>
    <button className="mt-6 min-h-14 rounded-2xl bg-white px-8 text-lg font-bold text-[#102a43]" onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(result.trackingCode.split("").join(" ")))}>🔊 Read code aloud</button>
    <a className="mt-5 underline" href={`/track?code=${result.trackingCode}`}>{t.track}</a>
  </main>;

  return <div className="mx-auto max-w-xl px-4 py-5 pb-10">
    <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-black">{t.title}</h1><button className="min-h-12 rounded-xl border px-3 font-bold" onClick={() => setLanguage(language === "en" ? "lg" : "en")}>🌐 {language === "en" ? "EN" : "LG"}</button></div>
    <a href="tel:999" className="mt-4 flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-red-700 px-4 text-lg font-black text-white">🚨 {t.emergency}</a>
    <button onClick={() => fileInput.current?.click()} className="mt-5 flex min-h-64 w-full flex-col items-center justify-center rounded-[2rem] bg-[#176b87] text-white shadow-lg">
      <span className="text-8xl" aria-hidden="true">📷</span><span className="mt-3 text-2xl font-black">{t.report}</span><span className="mt-1 text-sm">Photo or video</span>
    </button>
    <input ref={fileInput} className="hidden" type="file" accept="image/*,video/*" capture="environment" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} />
    {files.length > 0 && <p className="mt-2 text-sm">📎 {files.length} file(s) selected</p>}
    <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">{categories.map(([emoji, value]) => <button key={value} aria-label={value.replaceAll("_", " ")} aria-pressed={category === value} onClick={() => setCategory(value)} className={`min-h-14 rounded-xl border text-2xl ${category === value ? "border-[#176b87] bg-cyan-50 ring-2 ring-[#176b87]" : "bg-white"}`}>{emoji}</button>)}</div>
    <button onClick={toggleVoice} className="mt-4 min-h-14 w-full rounded-xl border-2 border-[#176b87] font-bold">{recording ? "⏹️ Stop recording" : voice ? "🎙️ Voice note ready" : `🎙️ ${t.voice}`}</button>
    <div className="mt-4 rounded-2xl bg-slate-100 p-4">
      <p className="font-bold">{position ? `📍 GPS captured (±${Math.round(position.accuracyM)} m)` : gpsFailed ? "📍 GPS unavailable" : "📍 Getting GPS location…"}</p>
      {gpsFailed && <label className="mt-2 block text-sm">{t.chooseStation}<select value={stationId} onChange={e => setStationId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white p-2"><option value="">Select station</option>{stations?.map(s => <option key={s._id} value={s._id}>{s.name} — {s.district}</option>)}</select></label>}
    </div>
    {waiting && <p className="mt-3 rounded-xl bg-amber-100 p-3 font-bold">🕓 {t.waiting}</p>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-100 p-3 text-red-800">{error}</p>}
    <button disabled={sending || (!position && !stationId)} onClick={() => void submit()} className="mt-5 min-h-16 w-full rounded-2xl bg-[#102a43] text-xl font-black text-white disabled:opacity-50">{sending ? "Sending…" : `📤 ${t.send}`}</button>
    <p className="mt-3 text-center text-xs text-slate-500">You can report without signing in. This app does not replace emergency services.</p>
  </div>;
}
