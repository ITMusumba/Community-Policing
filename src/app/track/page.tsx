"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { errorMessage } from "@/lib/errors";
import { api } from "@/convex/_generated/api";
import { compressImage, isNativeApp, onRestoredPhoto, takeNativePhoto } from "@/lib/media";

const statusIcon: Record<string, string> = { received: "📥", seen: "👁️", assigned: "👮", en_route: "🚓", closed: "✅", duplicate: "🧩", false: "⚠️" };

export default function TrackPage() {
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const addNote = useMutation(api.reports.addAnonymousNote);
  const uploadUrl = useMutation(api.reports.generateUploadUrl);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("code") || ""; const normalized = value.toUpperCase(); setCode(normalized); if (normalized) setToken(localStorage.getItem(`cp-track-${normalized}`) || ""); }, []);
  const data = useQuery(api.reports.trackAnonymous, code && token ? { code, token } : "skip");
  useEffect(() => onRestoredPhoto(setFile), []);
  // In the installed app, use the native camera; the browser keeps the <input capture> route.
  async function takePhoto(e: React.MouseEvent) {
    if (!isNativeApp()) return;
    e.preventDefault();
    try { const photo = await takeNativePhoto(); if (photo) setFile(photo); }
    catch (err) { setError(errorMessage(err, "Could not open the camera.")); }
  }

  async function send() {
    setError("");
    try {
      let storageId: string | undefined;
      let kind: "photo" | "voice" | undefined;
      if (file) {
        const url = await uploadUrl({ code, token });
        // Shrink photos first: full-size camera photos can exceed the server's 10 MB limit.
        const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": blob.type || file.type }, body: blob });
        if (!response.ok) throw new Error("Upload failed");
        storageId = (await response.json()).storageId;
        kind = file.type.startsWith("audio/") ? "voice" : "photo";
      }
      await addNote({ code, token, body: body.trim() || undefined, storageId: storageId as never, kind });
      setBody(""); setFile(null);
    } catch (e) { setError(errorMessage(e, "Could not send update.")); }
  }

  if (!code) return <main className="mx-auto max-w-lg p-6"><h1 className="text-2xl font-black">Track a report</h1><p className="mt-3">Open the link from your receipt or add ?code=YOUR-CODE to this page.</p></main>;
  if (!token) return <main className="mx-auto max-w-lg p-6"><h1 className="text-2xl font-black">🔐 Report follow-up</h1><p className="mt-3">This device has no saved follow-up key for {code}. Open the original device or enter the tracking key below.</p><label className="mt-4 block">Secret follow-up token<input id="token" className="mt-2 min-h-12 w-full rounded-xl border p-3" /></label><button onClick={() => { const value = (document.getElementById("token") as HTMLInputElement).value; localStorage.setItem(`cp-track-${code}`, value); setToken(value); }} className="mt-3 min-h-12 rounded-xl bg-[#102a43] px-5 font-bold text-white">Unlock report</button></main>;
  if (data === undefined) return <main className="p-6">Loading report…</main>;
  if (!data) return <main className="p-6"><h1 className="text-xl font-bold">Report not found or key invalid</h1></main>;
  const report = data.report;
  return <main className="mx-auto min-h-screen max-w-xl p-4 text-[#102a43] sm:p-6">
    <a href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm hover:bg-slate-50">🏠 Home</a>
    <header className="mt-4 rounded-2xl bg-[#102a43] p-5 text-white"><p className="text-sm">Tracking code</p><h1 className="mt-1 text-3xl font-black tracking-widest">{report.trackingCode}</h1><p className="mt-3 text-2xl">{statusIcon[report.status]} {report.status.replaceAll("_", " ")}</p><p className="mt-2 text-sm">{[report.parish, report.subcounty, report.district].filter(Boolean).join(" · ") || "Location pending"}</p></header>
    <section className="mt-5"><h2 className="text-lg font-black">Progress</h2><ol className="mt-3 space-y-3">{data.updates.map((update, i) => <li key={i} className="flex items-start gap-3 rounded-xl bg-white p-3"><span className="text-2xl">{statusIcon[update.toStatus] || "📝"}</span><div><p className="font-bold">{update.toStatus.replaceAll("_", " ")}</p><p className="text-xs text-slate-500">{new Date(update.createdAt).toLocaleString()}</p>{update.note && <p className="mt-1 text-sm">{update.note}</p>}</div></li>)}</ol></section>
    <section className="mt-5"><h2 className="text-lg font-black">Messages</h2>{data.notes.map((note, i) => <article key={i} className="mt-2 rounded-xl bg-white p-3"><p className="text-xs font-bold">{note.author === "officer" ? "👮 Police reply" : "🗣️ You"}</p>{note.body && <p className="mt-1">{note.body}</p>}{note.storageId && <p className="mt-1 text-xs">📎 Attachment available to authorised viewers</p>}</article>)}
    <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Add details or a message (optional)" className="mt-3 w-full rounded-xl border bg-white p-3" />
    {/* Visible buttons for the hidden file inputs; the bare browser "Choose file" control was easy to miss. */}
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label onClick={e => void takePhoto(e)} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold">📷 Add photo
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = ""; }} /></label>
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white font-semibold">🖼️ From gallery
        <input type="file" accept="image/*,audio/*" className="sr-only" onChange={e => { setFile(e.target.files?.[0] || null); e.target.value = ""; }} /></label>
    </div>
    {file && <p className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm"><span className="truncate">📎 {file.name}</span><button onClick={() => setFile(null)} className="shrink-0 font-semibold text-red-700">Remove</button></p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}<button onClick={() => void send()} className="mt-3 min-h-14 w-full rounded-xl bg-[#176b87] font-black text-white">📤 Send update</button></section>
  </main>;
}
