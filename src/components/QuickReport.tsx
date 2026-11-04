"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/lib/errors";
import { copy, type Language } from "@/lib/i18n";
import { compressImage, isNativeApp, onRestoredPhoto, takeNativePhoto } from "@/lib/media";

// Main grid (15 tiles). Less common categories sit behind "See more".
const mainCategories = [
  ["🥷", "theft"], ["🔪", "robbery"], ["🤕", "assault"], ["🏠", "domestic_violence"],
  ["🚸", "child_abuse"], ["🚗", "accident"], ["", "crop_theft"], ["💊", "drugs"],
  ["👁️", "suspicious_activity"], ["🐄", "livestock_theft"], ["🏡", "land_property_dispute"], ["🏠🔥", "arson"],
  ["🚯", "illegal_dumping"], ["💣", "terrorism"], ["❔", "other"],
] as const;
const moreCategories = [["🛑", "sexual_violence"], ["🔥", "fire"]] as const;
const categories = [...mainCategories, ...moreCategories] as const;
// There is no coffee-bean emoji, so crop theft uses a small drawn icon.
function CoffeeBeans({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <g transform="rotate(-28 22 34)"><ellipse cx="22" cy="34" rx="13" ry="18" fill="#7b4a2a" /><path d="M22 17c-6 8 6 18 0 34" stroke="#3e2314" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
    <g transform="rotate(24 43 30)"><ellipse cx="43" cy="30" rx="13" ry="18" fill="#9a5d36" /><path d="M43 13c-6 8 6 18 0 34" stroke="#4a2a17" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
  </svg>;
}
function CategoryIcon({ value, emoji, size }: { value: string; emoji: string; size: "lg" | "sm" }) {
  if (value === "crop_theft") return <CoffeeBeans className={size === "lg" ? "h-12 w-12" : "inline h-5 w-5 align-text-bottom"} />;
  // Arson is two emoji (house + fire); keep them on one line so its tile matches the others.
  const large = value === "arson" ? "whitespace-nowrap text-4xl" : "text-5xl";
  return <span className={size === "lg" ? large : "whitespace-nowrap"} aria-hidden="true">{emoji}</span>;
}
type Category = typeof categories[number][1];
type MediaItem = { storageId: string; kind: "photo" | "video" | "voice" };
// A queued report keeps its compressed photos/video/voice as Blobs on the phone until it can be uploaded.
type Pending = { deviceHash: string; category?: Category; description?: string; latitude?: number; longitude?: number; accuracyM?: number; fallbackStationId?: string; shareIdentity?: boolean; blobs: { blob: Blob; kind: MediaItem["kind"] }[] };

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

export default function QuickReport() {
  const [language, setLanguage] = useState<Language>("en");
  const [category, setCategory] = useState<Category | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const signedInCitizen = me?.role === "citizen" && me.isActive;
  const [shareIdentity, setShareIdentity] = useState(false);
  const generateUploadUrl = useMutation(api.reports.generateUploadUrl);
  const createReport = useMutation(api.reports.createAnonymousReport);
  const fileInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  // Photos/videos add up across Photo, Video and Gallery picks; the input is cleared so the same file can be picked again.
  const addFiles = (picked: File[]) => {
    if (!picked.length) return;
    setFiles(old => [...old, ...picked].slice(0, 8));
    setStep(2);
  };
  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    addFiles(picked);
  };
  // In the installed app the Photo button uses the native camera; browsers keep the <input capture> route.
  async function takePhoto() {
    if (!isNativeApp()) { fileInput.current?.click(); return; }
    try { const photo = await takeNativePhoto(); if (photo) addFiles([photo]); }
    catch (e) { setError(errorMessage(e, "Could not open the camera.")); }
  }
  // A photo taken just before Android closed the app comes back here when it reopens.
  useEffect(() => onRestoredPhoto(photo => addFiles([photo])), []);
  // Thumbnails so people can see what is attached.
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map(f => f.type.startsWith("image/") || f.type.startsWith("video/") ? URL.createObjectURL(f) : "");
    setPreviews(urls);
    return () => urls.forEach(u => u && URL.revokeObjectURL(u));
  }, [files]);
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
  async function sendPending(pending: Pending) {
    const media: MediaItem[] = [];
    for (const item of pending.blobs ?? []) media.push(await upload(item.blob, item.kind));
    const { blobs: _blobs, ...rest } = pending;
    const created = await createReport({ ...rest, media } as Parameters<typeof createReport>[0]);
    localStorage.setItem(`cp-track-${created.trackingCode}`, created.token);
    return created;
  }
  async function submit() {
    setSending(true); setError(""); setWaiting(false);
    let pending: Pending | null = null;
    try {
      // Compression is local, so it works offline; the result is what gets queued.
      const blobs: Pending["blobs"] = [];
      for (const file of files) blobs.push({ blob: file.type.startsWith("image/") ? await compressImage(file) : file, kind: file.type.startsWith("video/") ? "video" : "photo" });
      if (voice) blobs.push({ blob: voice, kind: "voice" });
      pending = { deviceHash: await hashDeviceId(), category: category ?? undefined, description: description.trim() || undefined, latitude: position?.latitude, longitude: position?.longitude, accuracyM: position?.accuracyM, shareIdentity: signedInCitizen && shareIdentity, fallbackStationId: stationId || undefined, blobs };
      if (!navigator.onLine) { await queueReport(pending); setWaiting(true); return; }
      const created = await sendPending(pending);
      setResult(created);
      window.history.replaceState({}, "", `/track?code=${encodeURIComponent(created.trackingCode)}`);
    } catch (e) {
      const message = errorMessage(e, "Could not send");
      if (pending && (!navigator.onLine || /network|fetch|upload failed|connection/i.test(message))) {
        try { await queueReport(pending); setWaiting(true); } catch { setError(message); }
      } else setError(message);
    } finally { setSending(false); }
  }
  useEffect(() => {
    const retry = async () => {
      if (!navigator.onLine) return;
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
            const created = await sendPending(item.value);
            setWaiting(false); setResult(created); // show the tracking code once the queued report is sent
            await new Promise<void>((resolve, reject) => { const request = db.transaction("reports", "readwrite").objectStore("reports").delete(item.key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
          } catch { break; }
        }
      } catch { /* queue remains for next online event */ }
    };
    void retry(); // also send anything left from an earlier session when the app is reopened
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createReport, generateUploadUrl]);

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
    <p className="mt-2 text-sm text-slate-300">Write this code down to follow up your report.</p>
    <a className="mt-6 flex min-h-14 items-center justify-center rounded-2xl bg-white px-8 text-lg font-bold text-[#102a43]" href={`/track?code=${result.trackingCode}`}>📋 {t.track}</a>
    <a className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-white/40 px-6 font-semibold text-white" href="/">🏠 Home</a>
  </main>;


  const CAT_LABEL: Record<Category, string> = {
    theft: "Theft", robbery: "Robbery", assault: "Assault", domestic_violence: "Home violence", sexual_violence: "Sexual assault",
    child_abuse: "Child abuse", crop_theft: "Crop theft",
    accident: "Traffic accident", fire: "Fire", drugs: "Drugs", suspicious_activity: "Suspicious", livestock_theft: "Animal theft",
    land_property_dispute: "Land", arson: "Arson", illegal_dumping: "Dumping", terrorism: "Terrorism", other: "Other",
  };
  const speak = (text: string) => { try { window.speechSynthesis?.cancel(); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text)); } catch { /* no speech */ } };
  // One Skip style on every step.
  const SkipButton = ({ onClick }: { onClick: () => void }) => <button onClick={onClick} className="mt-4 min-h-14 w-full rounded-2xl border-2 border-[#176b87] bg-white text-lg font-bold text-[#176b87] hover:bg-cyan-50">{t.skip} →</button>;
  const hasDescription = Boolean(description.trim() || voice);
  const thumbs = files.length ? <div className="mt-3 flex flex-wrap justify-center gap-2">{files.map((f, i) => <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border-2 border-white bg-slate-200 shadow">
    {f.type.startsWith("video/") ? <video src={previews[i]} muted playsInline className="h-full w-full object-cover" /> : previews[i] ? <img src={previews[i]} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-2xl">📎</span>}
    <button onClick={() => setFiles(old => old.filter((_, j) => j !== i))} aria-label={`Remove attachment ${i + 1}`} className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white">✕</button>
  </div>)}</div> : null;
  const Dots = () => <div className="flex items-center gap-2" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map(n => <span key={n} className={`h-2.5 w-8 rounded-full ${n <= step ? "bg-[#176b87]" : "bg-slate-300"}`} />)}</div>;
  const header = <div className="flex items-center justify-between gap-3">
    {step > 1 ? <button onClick={() => setStep(step === 3 ? 2 : 1)} className="min-h-12 rounded-xl bg-[#176b87] px-4 text-lg font-bold text-white shadow hover:bg-[#125670]" aria-label="Back">←</button> : <span aria-hidden="true" />}
    <Dots />
    <button className="min-h-12 rounded-xl border px-3 font-bold" onClick={() => setLanguage(language === "en" ? "lg" : "en")}>🌐 {language === "en" ? "EN" : "LG"}</button>
  </div>;

  return <div className="mx-auto max-w-xl px-4 py-5 pb-10">
    {step === 1 && <>
      <h1 className="text-center text-4xl font-black tracking-[0.2em] text-[#102a43]">COMPOLI</h1>
      <a href="tel:999" className="mt-3 mb-5 flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-red-700 px-4 text-lg font-black text-white">🚨 {t.emergency}</a>
    </>}
    {header}
    {/* Separate inputs: a combined image+video input with `capture` opens some Android cameras in video mode only. */}
    <input ref={fileInput} className="hidden" type="file" accept="image/*" capture="environment" onChange={pickFiles} />
    <input ref={videoInput} className="hidden" type="file" accept="video/*" capture="environment" onChange={pickFiles} />
    <input ref={galleryInput} className="hidden" type="file" accept="image/*,video/*" multiple onChange={pickFiles} />

    {step === 1 && <>
      <div className="mt-5 rounded-[2rem] bg-[#176b87] p-4 text-white shadow-lg">
        <p className="text-center text-2xl font-black">{t.report}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button onClick={() => void takePhoto()} className="flex min-h-48 flex-col items-center justify-center rounded-3xl bg-white/15 hover:bg-white/25">
            <span className="text-7xl" aria-hidden="true">📷</span><span className="mt-2 text-xl font-black">{t.photo}</span>
          </button>
          <button onClick={() => videoInput.current?.click()} className="flex min-h-48 flex-col items-center justify-center rounded-3xl bg-white/15 hover:bg-white/25">
            <span className="text-7xl" aria-hidden="true">🎥</span><span className="mt-2 text-xl font-black">{t.video}</span>
          </button>
        </div>
        <button onClick={() => galleryInput.current?.click()} className="mt-3 w-full text-center text-sm underline">🖼️ {t.gallery}</button>
      </div>
      {thumbs}
      {files.length > 0 && <button onClick={() => setStep(2)} className="mt-3 min-h-14 w-full rounded-xl bg-emerald-700 text-lg font-bold text-white">✅ {files.length} 📎 → </button>}
      <SkipButton onClick={() => setStep(2)} />
    </>}

    {step === 2 && <>
      <h2 className="mt-6 flex items-center justify-center gap-2 text-center text-2xl font-black">❓ {t.whatHappened} <button onClick={() => speak(t.whatHappened)} aria-label="Read aloud" className="text-2xl">🔊</button></h2>
      {(() => {
        const tile = ([emoji, value]: readonly [string, Category]) => <button key={value} aria-pressed={category === value}
          onClick={() => { setCategory(value); speak(CAT_LABEL[value]); setStep(3); }}
          className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 bg-white ${category === value ? "border-[#176b87] ring-4 ring-cyan-200" : "border-slate-300"}`}>
          <CategoryIcon value={value} emoji={emoji} size="lg" /><span className="mt-1 text-xs font-semibold text-slate-700">{CAT_LABEL[value]}</span></button>;
        const moreOpen = showMore || moreCategories.some(c => c[1] === category);
        return <>
          <div className="mt-5 grid grid-cols-3 gap-3">{mainCategories.map(tile)}</div>
          <button onClick={() => setShowMore(!moreOpen)} aria-expanded={moreOpen} className="mt-3 min-h-12 w-full rounded-xl bg-slate-200 text-base font-bold text-[#102a43]">{moreOpen ? `▲ ${t.seeLess}` : `▼ ${t.seeMore}`}</button>
          {moreOpen && <div className="mt-3 grid grid-cols-3 gap-3">{moreCategories.map(tile)}</div>}
        </>;
      })()}
      <SkipButton onClick={() => { setCategory(null); setStep(3); }} />
    </>}

    {step === 3 && <>
      <h2 className="mt-6 flex items-center justify-center gap-2 text-center text-2xl font-black">🗣️ {t.describe} <button onClick={() => speak(t.describe)} aria-label="Read aloud" className="text-2xl">🔊</button></h2>
      <div className="mt-3 flex justify-center gap-3 text-sm text-slate-700">
        <span>{files.length ? `📷 ✅ ${files.length}` : "📷 —"}</span><span>{category ? <><CategoryIcon value={category} emoji={categories.find(c => c[1] === category)?.[0] ?? ""} size="sm" /> ✅</> : "❓ —"}</span>
      </div>
      {thumbs}
      <button onClick={toggleVoice} className={`mt-5 flex min-h-36 w-full flex-col items-center justify-center rounded-[2rem] text-white shadow ${recording ? "bg-red-700" : voice ? "bg-emerald-700" : "bg-[#176b87]"}`}>
        <span className="text-7xl" aria-hidden="true">{recording ? "⏹️" : voice ? "✅" : "🎙️"}</span>
        <span className="mt-2 text-xl font-black">{recording ? t.stopRecording : voice ? t.voiceReady : t.voice}</span>
      </button>
      {voice && !recording && <button onClick={() => { setVoice(null); void toggleVoice(); }} className="mt-2 min-h-11 w-full text-sm font-semibold text-slate-600 underline">🔁 {t.reRecord}</button>}
      <label className="mt-4 block text-sm font-semibold text-slate-700">✍️ {t.typeHere}
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={3000} className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-base" />
      </label>
      <div className="mt-4 rounded-2xl bg-slate-100 p-4">
        <p className="font-bold">{position ? `📍 ${t.gpsOk} (±${Math.round(position.accuracyM)} m)` : gpsFailed ? `📍 ${t.gpsFailed}` : `📍 ${t.gpsWaiting}`}</p>
        {gpsFailed && <label className="mt-2 block text-sm">{t.chooseStation}<select value={stationId} onChange={e => setStationId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border bg-white p-2"><option value="">—</option>{[...new Set((stations ?? []).map(s => s.district))].sort().map(d => <optgroup key={d} label={d}>{stations?.filter(s => s.district === d).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</optgroup>)}</select></label>}
      </div>
      {signedInCitizen && <label className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-sm"><input type="checkbox" checked={shareIdentity} onChange={e => setShareIdentity(e.target.checked)} className="mt-1 h-5 w-5" /><span>Share my name and phone with police<span className="block text-xs text-slate-500">Otherwise you stay anonymous. Replies still reach <a href="/citizen" className="underline">My account</a>.</span></span></label>}
      {(!category || !hasDescription) && <p className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 font-semibold text-amber-900">⚠️ {t.unsupportedWarn}</p>}
      {waiting && <p className="mt-3 rounded-xl bg-amber-100 p-3 font-bold">🕓 {t.waiting}</p>}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-100 p-3 text-red-800">{error}</p>}
      <button disabled={sending || recording || (!position && !stationId)} onClick={() => void submit()} className="mt-5 min-h-16 w-full rounded-2xl bg-[#102a43] text-xl font-black text-white disabled:opacity-50">{sending ? "…" : `📤 ${t.send}`}</button>
    </>}

    <p className="mt-6 text-center text-xs text-slate-500">{t.anonNote}</p>
    {step === 1 && <p className="mt-2 text-center text-xs text-slate-500"><a href="/stations" className="font-bold underline">Find a police station</a> · <a href="/citizen" className="font-bold underline">My account</a> · <a href="/police/login" className="font-bold underline">Officer Sign In</a></p>}
  </div>;
}
