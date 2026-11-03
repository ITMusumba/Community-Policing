"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, Ban, Car, CheckCircle2, Clock, Copy, ExternalLink, FileText, MapPin, SlidersHorizontal, UserCheck, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import PoliceShell from "@/components/PoliceShell";
import IncidentMap from "@/components/IncidentMap";
import { errorMessage } from "@/lib/errors";
import { CATEGORY_LABEL, PRIORITY, STATUS_LABEL, elapsed, responseState, type Priority } from "@/lib/police";

const cats = ["theft","robbery","assault","domestic_violence","child_abuse","sexual_violence","accident","fire","drugs","suspicious_activity","livestock_theft","crop_theft","land_property_dispute","arson","illegal_dumping","terrorism","other"] as const;
const statuses = ["received","seen","assigned","en_route","closed","duplicate","false"] as const;
type Outcome = "close" | "duplicate" | "false";
const OUTCOMES: Record<Outcome, { title: string; reasons: string[] }> = {
  close: { title: "Close with outcome", reasons: ["Resolved on scene", "Suspect arrested", "Referred to CID", "Referred to another agency", "No offence disclosed", "Complainant could not be reached"] },
  duplicate: { title: "Close as duplicate", reasons: ["Duplicate of an existing incident"] },
  false: { title: "Reject as unfounded", reasons: ["Malicious or prank report", "Unrelated content", "No incident found at location"] },
};

export default function PolicePage() {
  return <PoliceShell active="incidents">{profile => <IncidentFeed profile={profile} />}</PoliceShell>;
}

function IncidentFeed({ profile }: { profile: Doc<"userProfiles"> }) {
  const [district, setDistrict] = useState("");
  const [subcounty, setSubcounty] = useState("");
  const [parish, setParish] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const feed = useQuery(api.reports.officerFeed, {
    district: district || undefined, subcounty: subcounty || undefined, parish: parish || undefined,
    category: category ? category as typeof cats[number] : undefined, status: status ? status as typeof statuses[number] : undefined,
  });
  const reports = useMemo(() => feed ?? [], [feed]);
  // Full Uganda list, so an officer can look at any district even before it has reports.
  const districts = useQuery(api.geo.districts, {}) ?? [];
  const subcounties = useQuery(api.geo.subcounties, district ? { district } : "skip") ?? [];
  const parishes = useQuery(api.geo.parishes, district && subcounty ? { district, subcounty } : "skip") ?? [];
  const select = "min-h-11 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900";
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = [district, subcounty, parish, category, status].filter(Boolean).length;
  const clearFilters = () => { setDistrict(""); setSubcounty(""); setParish(""); setCategory(""); setStatus(""); };

  return <>
    {/* Filters live behind one button so the incident keeps the screen on a phone. */}
    <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 pt-3">
      <p className="text-sm text-slate-600">{feed ? `${reports.length} incident${reports.length === 1 ? "" : "s"}` : ""}{activeFilters ? " · filtered" : ""}</p>
      <div className="flex gap-2">
        {activeFilters > 0 && <button onClick={clearFilters} className="min-h-10 rounded px-2 text-sm text-slate-700 underline">Clear</button>}
        <button onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters} className="flex min-h-10 items-center gap-1.5 rounded border border-slate-300 bg-white px-3 text-sm font-medium"><SlidersHorizontal size={15} aria-hidden="true" />Filters{activeFilters > 0 && <span className="rounded bg-[#0b1f33] px-1.5 text-xs text-white">{activeFilters}</span>}</button>
      </div>
    </div>
    {showFilters && <div className="mx-auto max-w-3xl px-3 pt-2">
      <div className="grid grid-cols-1 gap-2 rounded border border-slate-300 bg-white p-3 sm:grid-cols-2">
        <select aria-label="District" value={district} onChange={e=>{setDistrict(e.target.value);setSubcounty("");setParish("");}} className={select}><option value="">All districts</option>{districts.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Subcounty" value={subcounty} onChange={e=>{setSubcounty(e.target.value);setParish("");}} className={select}><option value="">All subcounties</option>{subcounties.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Parish" value={parish} onChange={e=>setParish(e.target.value)} className={select}><option value="">All parishes</option>{parishes.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)} className={select}><option value="">All categories</option>{cats.map(x=><option key={x} value={x}>{CATEGORY_LABEL[x]}</option>)}</select>
        <select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)} className={select}><option value="">All statuses</option>{statuses.map(x=><option key={x} value={x}>{STATUS_LABEL[x]}</option>)}</select>
        <button onClick={() => setShowFilters(false)} className="min-h-11 rounded bg-[#0b1f33] text-sm font-medium text-white sm:col-span-2">Apply</button>
      </div>
    </div>}
    <main className="mx-auto max-w-3xl snap-y px-3 py-4">
      {!feed && <p className="p-4 text-sm text-slate-600">Loading incidents…</p>}
      {feed?.length === 0 && <div className="rounded border border-slate-300 bg-white p-8 text-center"><p className="font-semibold">No incidents in this view</p><p className="mt-1 text-sm text-slate-600">New incidents appear here automatically.</p></div>}
      {reports.map(r => <IncidentCard key={r._id} report={r} now={now} />)}
    </main>
  </>;
}

type FeedRow = FunctionReturnType<typeof api.reports.officerFeed>[number];

function IncidentCard({ report: r, now }: { report: FeedRow; now: number }) {
  const action = useMutation(api.reports.officerAction);
  const sendReply = useMutation(api.reports.replyToAnonymousReport);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const priority: Priority = r.priority ?? "p4";
  const open = ["received", "seen", "assigned", "en_route"].includes(r.status);
  const timer = responseState(r.createdAt, r.firstResponseAt, priority, now);

  async function run(args: Parameters<typeof action>[0]) {
    setError("");
    try { await action(args); setOutcome(null); setReason(""); setDetail(""); }
    catch (e) { setError(errorMessage(e, "Action failed.")); }
  }
  const btn = "flex min-h-11 items-center justify-center gap-1.5 rounded border px-3 text-sm font-medium disabled:opacity-40";

  return <article className="mb-4 snap-start overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${PRIORITY[priority].badge}`}>{PRIORITY[priority].short}</span>
        <span className="font-mono text-sm font-semibold">{r.referenceNumber ?? r.trackingCode}</span>
      </div>
      <span className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-700">{STATUS_LABEL[r.status]}</span>
    </header>

    <div className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{CATEGORY_LABEL[r.category]}</h2>
        <p className="flex items-center gap-1 text-sm text-slate-600"><Clock size={14} aria-hidden="true" />Received {elapsed(now - r.createdAt)} ago · {new Date(r.createdAt).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" })}</p>
      </div>
      {r.supportNote && <p className="mt-2 flex items-center gap-1.5 rounded border border-amber-400 bg-amber-50 px-2 py-1 text-sm font-semibold text-amber-900"><AlertTriangle size={15} aria-hidden="true" />{r.supportNote}</p>}
      {r.description && <blockquote className="mt-2 border-l-4 border-slate-300 pl-3 text-sm text-slate-800"><span className="block text-xs uppercase tracking-wide text-slate-500">Reporter&apos;s description</span>{r.description}</blockquote>}
      {open && <p className={`mt-2 flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium ${timer.tone}`}>{timer.overdue && <AlertTriangle size={15} aria-hidden="true" />}{timer.text}</p>}
      <p className="mt-2 flex items-start gap-1.5 text-sm"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /><span>{[r.parish, r.subcounty, r.district].filter(Boolean).join(", ") || "Location not determined"}<span className="text-slate-500"> · GPS {r.accuracyM ? `±${Math.round(r.accuracyM)} m` : "not provided"}</span>
        {r.latitude !== undefined && r.longitude !== undefined && <> · <a className="inline-flex items-center gap-0.5 text-blue-800 underline" href={`https://maps.google.com/?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">Open in maps<ExternalLink size={12} aria-hidden="true" /></a></>}</span></p>
      <p className="mt-1 text-sm text-slate-600">Assigned: {r.assignedOfficer ?? "Unassigned"} · Citizen ref. {r.trackingCode}</p>
      <p className="mt-1 text-sm text-slate-600">Reporter: {r.reporter ? <>{r.reporter.name}{r.reporter.phone && <> · <a className="text-blue-800 underline" href={`tel:${r.reporter.phone}`}>{r.reporter.phone}</a></>} <span className="text-xs">(shared by reporter)</span></> : "Anonymous"}</p>
    </div>

    <section aria-label="Evidence" className="bg-slate-900">
      {r.media.filter(m => m.url).length === 0
        ? <p className="px-4 py-6 text-center text-sm text-slate-400">No photo or video evidence submitted.</p>
        : <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto">{r.media.map(m => !m.url ? null : m.kind === "photo"
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={m._id} src={m.url} alt="Evidence photograph" className="max-h-[50vh] w-full shrink-0 snap-center object-contain" />
            : m.kind === "video" ? <video key={m._id} src={m.url} controls playsInline className="max-h-[50vh] w-full shrink-0 snap-center" />
            : <div key={m._id} className="w-full shrink-0 snap-center p-4"><p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Voice statement</p><audio src={m.url} controls className="w-full" /></div>)}</div>}
    </section>

    <div className="space-y-3 px-4 py-3">
      {r.notes.length > 0 && <details open className="rounded border border-slate-200">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Statements and correspondence ({r.notes.length})</summary>
        <ul className="divide-y divide-slate-100 text-sm">{r.notes.map(n => <li key={n._id} className="px-3 py-2"><span className="font-medium">{n.author === "citizen" ? "Reporter (anonymous)" : "Police"}</span> <span className="text-xs text-slate-500">{new Date(n.createdAt).toLocaleString("en-UG")}</span><p>{n.body}{n.url && <> <a className="text-blue-800 underline" href={n.url} target="_blank" rel="noreferrer">attachment</a></>}</p></li>)}</ul>
      </details>}
      {r.latitude !== undefined && r.longitude !== undefined && <IncidentMap lat={r.latitude} lng={r.longitude} />}
      <details className="rounded border border-slate-200">
        <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-semibold"><FileText size={14} aria-hidden="true" />Occurrence log ({r.log.length})</summary>
        <ol className="divide-y divide-slate-100 font-mono text-xs">{r.log.map(l => <li key={l._id} className="px-3 py-1.5"><span className="text-slate-500">{new Date(l.createdAt).toLocaleString("en-UG")}</span> — {l.note ?? STATUS_LABEL[l.toStatus as keyof typeof STATUS_LABEL] ?? l.toStatus} — <span className="text-slate-600">{l.actor}</span></li>)}</ol>
      </details>

      {open && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button className={`${btn} border-slate-300`} disabled={r.status !== "received"} onClick={() => void run({ reportId: r._id, action: "verify" })}><CheckCircle2 size={16} aria-hidden="true" />Acknowledge</button>
        <button className={`${btn} border-slate-300`} onClick={() => void run({ reportId: r._id, action: "assign_me" })}><UserCheck size={16} aria-hidden="true" />Take ownership</button>
        <button className={`${btn} border-slate-300`} disabled={r.status === "en_route"} onClick={() => void run({ reportId: r._id, action: "en_route" })}><Car size={16} aria-hidden="true" />Dispatch</button>
        <select aria-label="Priority" value={priority} onChange={e => void run({ reportId: r._id, action: "set_priority", priority: e.target.value as Priority })} className="min-h-11 rounded border border-slate-300 bg-white px-2 text-sm">{(Object.keys(PRIORITY) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}</select>
        <button className={`${btn} border-[#0b1f33] bg-[#0b1f33] text-white`} onClick={() => setOutcome("close")}><CheckCircle2 size={16} aria-hidden="true" />Close…</button>
        <button className={`${btn} border-slate-300`} onClick={() => setOutcome("duplicate")}><Copy size={16} aria-hidden="true" />Duplicate…</button>
        <button className={`${btn} border-red-300 text-red-800`} onClick={() => setOutcome("false")}><Ban size={16} aria-hidden="true" />Unfounded…</button>
      </div>}

      {outcome && <div role="dialog" aria-label={OUTCOMES[outcome].title} className="rounded border-2 border-slate-800 bg-slate-50 p-3">
        <p className="text-sm font-semibold">{OUTCOMES[outcome].title} — {r.referenceNumber ?? r.trackingCode}</p>
        <select aria-label="Reason" value={reason} onChange={e => setReason(e.target.value)} className="mt-2 min-h-11 w-full rounded border border-slate-300 bg-white px-2 text-sm"><option value="">Select a reason (required)</option>{OUTCOMES[outcome].reasons.map(x => <option key={x}>{x}</option>)}</select>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={2} placeholder="Additional remarks for the record (optional)" className="mt-2 w-full rounded border border-slate-300 p-2 text-sm" />
        <p className="mt-1 text-xs text-slate-600">This action is recorded in the occurrence log under your name and badge number.</p>
        <div className="mt-2 flex gap-2">
          <button disabled={!reason} onClick={() => void run({ reportId: r._id, action: outcome, reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason })} className={`${btn} border-[#0b1f33] bg-[#0b1f33] text-white`}>Confirm</button>
          <button onClick={() => { setOutcome(null); setReason(""); setDetail(""); }} className={`${btn} border-slate-300`}><XCircle size={16} aria-hidden="true" />Cancel</button>
        </div>
      </div>}
      {!open && r.closeReason && <p className="rounded bg-slate-100 px-3 py-2 text-sm"><span className="font-medium">Outcome:</span> {r.closeReason}</p>}
      {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="flex gap-2">
        <input aria-label="Message to reporter" value={reply} onChange={e => setReply(e.target.value)} placeholder="Message to reporter (identity is never shown)" className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm" />
        <button onClick={async () => { const body = reply.trim(); if (!body) return; try { await sendReply({ reportId: r._id, body }); setReply(""); } catch (e) { setError(errorMessage(e, "Message not sent.")); } }} className={`${btn} border-slate-300`}>Send</button>
      </div>
    </div>
  </article>;
}
