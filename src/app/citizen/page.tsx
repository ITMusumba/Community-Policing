"use client";

import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import ChangePassword from "@/components/ChangePassword";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/police";

type Report = FunctionReturnType<typeof api.citizen.myReports>[number];
const CLOSED = ["closed", "duplicate", "false"];
const fmt = (t: number) => new Date(t).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" });

/** Code + secret token pairs this device saved when reporting anonymously (see QuickReport). */
function deviceReports() {
  const items: { code: string; token: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("cp-track-")) items.push({ code: key.slice(9), token: localStorage.getItem(key) ?? "" });
    }
  } catch { /* storage unavailable */ }
  return items.filter(i => i.token);
}

export default function CitizenPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const isCitizen = profile?.role === "citizen" && profile.isActive;
  const reports = useQuery(api.citizen.myReports, isCitizen ? {} : "skip");
  const claim = useMutation(api.citizen.claimReports);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"reports" | "details">("reports");
  const claimed = useRef(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || profile === null)) window.location.replace("/citizen/login?next=/citizen");
  }, [isLoading, isAuthenticated, profile]);

  useEffect(() => {
    if (!isCitizen || claimed.current) return;
    claimed.current = true;
    const items = deviceReports();
    if (items.length) void claim({ items }).catch(() => undefined);
  }, [isCitizen, claim]);

  if (isLoading || !isAuthenticated || profile === undefined || profile === null) return <main className="p-6 text-sm">Loading your account…</main>;
  if (!isCitizen) return <main className="mx-auto max-w-xl p-6 text-sm">
    <p>This is a staff account. <a className="underline" href="/police">Open the police portal</a>.</p>
    <button onClick={() => void signOut()} className="mt-3 underline">Sign out</button>
  </main>;

  const unread = (reports ?? []).reduce((n, r) => n + r.unread, 0);
  return <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-4 text-[#102a43] sm:p-6">
    <div className="flex items-center justify-between gap-2">
      <a href="/" className="text-sm font-bold underline">← Report an incident</a>
      <button onClick={() => void signOut().then(() => window.location.replace("/"))} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold">Sign out</button>
    </div>
    <h1 className="mt-4 text-2xl font-black">Hello, {profile.displayName}</h1>
    <p className="mt-1 text-sm text-slate-600">{unread ? `${unread} new police ${unread === 1 ? "reply" : "replies"}.` : "Your reports and police replies appear here."}</p>

    <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-200 p-1 text-sm font-semibold">
      <button onClick={() => setTab("reports")} className={`min-h-10 rounded-lg ${tab === "reports" ? "bg-white shadow-sm" : "text-slate-600"}`}>My reports</button>
      <button onClick={() => setTab("details")} className={`min-h-10 rounded-lg ${tab === "details" ? "bg-white shadow-sm" : "text-slate-600"}`}>My details</button>
    </div>

    {tab === "reports" && <>
      {reports === undefined && <p className="mt-4 text-sm">Loading reports…</p>}
      {reports?.length === 0 && <p className="mt-4 rounded-xl bg-white p-4 text-sm">No reports yet. Reports you send while signed in, or sent earlier from this phone, appear here.</p>}
      <ul className="mt-4 space-y-3">{reports?.map(r => <li key={r._id}>
        <ReportCard report={r} open={openId === r._id} onToggle={() => setOpenId(openId === r._id ? null : r._id)} />
      </li>)}</ul>
    </>}
    {tab === "details" && <div className="mt-4 space-y-4"><MyDetails name={profile.displayName} phone={profile.phone ?? ""} /><ChangePassword /></div>}
  </main>;
}

function ReportCard({ report: r, open, onToggle }: { report: Report; open: boolean; onToggle: () => void }) {
  const markSeen = useMutation(api.citizen.markSeen);
  const addNote = useMutation(api.citizen.addNote);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const closed = CLOSED.includes(r.status);

  useEffect(() => { if (open && r.unread) void markSeen({ reportId: r._id }); }, [open, r.unread, r._id, markSeen]);

  async function send() {
    setError("");
    try { await addNote({ reportId: r._id, body }); setBody(""); }
    catch (e) { setError(e instanceof Error ? e.message.replace(/^.*Uncaught ConvexError: /, "").split("\n")[0] : "Message not sent."); }
  }

  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <button onClick={onToggle} aria-expanded={open} className="flex w-full items-start justify-between gap-3 p-4 text-left">
      <div className="min-w-0">
        <p className="font-bold">{CATEGORY_LABEL[r.category] ?? r.category}</p>
        <p className="truncate text-xs text-slate-500">{r.trackingCode} · {fmt(r.createdAt)}{r.place ? ` · ${r.place}` : ""}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{STATUS_LABEL[r.status as keyof typeof STATUS_LABEL] ?? r.status}</span>
        {r.unread > 0 && <span className="rounded-full bg-[#176b87] px-2 py-0.5 text-xs font-bold text-white">{r.unread} new</span>}
      </div>
    </button>
    {open && <div className="space-y-3 border-t border-slate-100 p-4 text-sm">
      <p className="text-xs text-slate-500">{r.shareIdentity ? "You shared your name and phone with police on this report." : "Police see this report as anonymous."}</p>
      <ol className="space-y-1">{r.updates.map(u => <li key={u._id} className="text-xs text-slate-600">{fmt(u.createdAt)} — {STATUS_LABEL[u.toStatus as keyof typeof STATUS_LABEL] ?? u.toStatus}</li>)}</ol>
      <div className="space-y-2">{r.notes.length === 0 && <p className="text-slate-500">No messages yet.</p>}
        {r.notes.map(n => <div key={n._id} className={`rounded-xl p-3 ${n.author === "officer" ? "bg-cyan-50" : "ml-6 bg-slate-100"}`}>
          <p className="text-xs font-bold">{n.author === "officer" ? "👮 Police" : "You"} · <span className="font-normal text-slate-500">{fmt(n.createdAt)}</span></p>
          {n.body && <p className="mt-1">{n.body}</p>}{n.hasAttachment && <p className="mt-1 text-xs">📎 Attachment sent</p>}
        </div>)}
      </div>
      {closed
        ? <p className="rounded-xl bg-slate-100 p-3 text-slate-600">This report is closed. For a new incident, send a new report.</p>
        : <div className="flex gap-2"><input value={body} onChange={e => setBody(e.target.value)} placeholder="Message the police" aria-label="Message the police" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3" />
            <button disabled={!body.trim()} onClick={() => void send()} className="min-h-11 rounded-xl bg-[#102a43] px-4 font-bold text-white disabled:opacity-50">Send</button></div>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </div>}
  </article>;
}

function MyDetails({ name, phone }: { name: string; phone: string }) {
  const update = useMutation(api.citizen.updateMyDetails);
  const [displayName, setDisplayName] = useState(name);
  const [tel, setTel] = useState(phone);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return <form onSubmit={async e => { e.preventDefault(); setMsg(null); try { await update({ displayName, phone: tel || undefined }); setMsg({ ok: true, text: "Details saved." }); } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message.replace(/^.*Uncaught ConvexError: /, "").split("\n")[0] : "Could not save." }); } }}
    className="space-y-3 rounded border border-slate-300 bg-white p-4 text-sm">
    <h2 className="text-lg font-semibold">My details</h2>
    <p className="text-slate-600">Police only see these when you tick &quot;Share my name and phone&quot; on a report.</p>
    <label className="block">Name<input value={displayName} onChange={e => setDisplayName(e.target.value)} required minLength={2} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
    <label className="block">Phone<input type="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="+256 7xx xxxxxx" className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label>
    {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded px-3 py-2 ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}
    <button className="min-h-11 rounded bg-[#0b1f33] px-4 font-medium text-white">Save details</button>
  </form>;
}
