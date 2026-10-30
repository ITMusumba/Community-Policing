"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthPanel from "@/components/AuthPanel";

const cats = ["theft","robbery","assault","domestic_violence","sexual_violence","accident","fire","drugs","suspicious_activity","livestock_theft","land_property_dispute","other"] as const;
const statuses = ["received","seen","assigned","en_route","closed","duplicate","false"] as const;
const icons: Record<string,string> = { theft:"👜", robbery:"🔫", assault:"🩹", domestic_violence:"🏠", sexual_violence:"🛑", accident:"🚗", fire:"🔥", drugs:"💊", suspicious_activity:"👁️", livestock_theft:"🐄", land_property_dispute:"🏡", other:"❔" };
function ago(time: number) { const mins = Math.max(0, Math.floor((Date.now()-time)/60000)); return mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins/60)}h ago` : `${Math.floor(mins/1440)}d ago`; }

export default function PolicePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const [district, setDistrict] = useState("");
  const [subcounty, setSubcounty] = useState("");
  const [parish, setParish] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [reply, setReply] = useState<Record<string,string>>({});
  const feed = useQuery(api.reports.officerFeed, isAuthenticated && profile && ["officer","admin","super_admin"].includes(profile.role) ? {
    district: district || undefined, subcounty: subcounty || undefined, parish: parish || undefined,
    category: category ? category as typeof cats[number] : undefined, status: status ? status as typeof statuses[number] : undefined,
  } : "skip");
  const action = useMutation(api.reports.officerAction);
  const sendReply = useMutation(api.reports.replyToAnonymousReport);
  const reports = feed || [];
  const districts = useMemo(() => [...new Set(reports.map(r => r.district).filter(Boolean))] as string[], [reports]);
  const subcounties = useMemo(() => [...new Set(reports.filter(r => !district || r.district === district).map(r => r.subcounty).filter(Boolean))] as string[], [reports, district]);
  const parishes = useMemo(() => [...new Set(reports.filter(r => (!district || r.district === district) && (!subcounty || r.subcounty === subcounty)).map(r => r.parish).filter(Boolean))] as string[], [reports, district, subcounty]);

  if (isLoading) return <main className="p-6">Loading secure police access…</main>;
  if (!isAuthenticated || !profile) return <main className="mx-auto max-w-xl p-4"><h1 className="mb-4 text-2xl font-black">👮 Police sign in</h1><AuthPanel enabled={true} staffOnly /></main>;
  if (!["officer","admin","super_admin"].includes(profile.role)) return <main className="p-6">This account does not have police access.</main>;

  return <main className="h-screen snap-y snap-mandatory overflow-y-scroll bg-[#102a43] text-white">
    <header className="sticky top-0 z-10 border-b border-white/20 bg-[#102a43]/95 p-3 backdrop-blur"><div className="flex items-center justify-between"><h1 className="font-black">👮 Police feed</h1><a href="/" className="text-sm underline">Citizen app</a></div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <select aria-label="District" value={district} onChange={e=>{setDistrict(e.target.value);setSubcounty("");setParish("");}} className="min-h-11 rounded-lg bg-white p-2 text-slate-900"><option value="">My district</option>{districts.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Subcounty" value={subcounty} onChange={e=>{setSubcounty(e.target.value);setParish("");}} className="min-h-11 rounded-lg bg-white p-2 text-slate-900"><option value="">All subcounties</option>{subcounties.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Parish" value={parish} onChange={e=>setParish(e.target.value)} className="min-h-11 rounded-lg bg-white p-2 text-slate-900"><option value="">All parishes</option>{parishes.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)} className="min-h-11 rounded-lg bg-white p-2 text-slate-900"><option value="">All categories</option>{cats.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select>
        <select aria-label="Status" value={status} onChange={e=>setStatus(e.target.value)} className="min-h-11 rounded-lg bg-white p-2 text-slate-900"><option value="">All status</option>{statuses.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select>
      </div></header>
    {!feed && <div className="p-6">Loading reports…</div>}
    {feed?.length === 0 && <section className="flex min-h-[75vh] snap-start flex-col items-center justify-center p-8 text-center"><span className="text-7xl">🛡️</span><h2 className="mt-5 text-2xl font-black">No reports in this view</h2><p className="mt-2">New reports appear here automatically.</p></section>}
    {reports.map(report => <section key={report._id} className="flex min-h-[calc(100vh-120px)] snap-start flex-col justify-between border-b border-white/15 p-4 sm:p-8">
      <div><div className="flex items-center justify-between gap-2"><span className="rounded-full bg-white/15 px-3 py-2 text-sm">{ago(report.createdAt)}</span><span className="text-sm">{report.status.replaceAll("_"," ")}</span></div>
        <div className="mt-5 flex min-h-52 flex-wrap items-center justify-center gap-2 rounded-3xl bg-white/10 p-2 text-8xl">
          {report.media.length === 0 && <>{icons[report.category] || "❔"}{report.status === "received" && <span className="ml-2 text-3xl">📥</span>}</>}
          {report.media.map(m => !m.url ? null : m.kind === "photo"
            ? <img key={m._id} src={m.url} alt="Evidence photo" className="max-h-72 max-w-full rounded-2xl object-contain" />
            : m.kind === "video"
              ? <video key={m._id} src={m.url} controls className="max-h-72 max-w-full rounded-2xl" />
              : <audio key={m._id} src={m.url} controls className="w-full" />)}
        </div>
        <h2 className="mt-4 text-2xl font-black">{report.category.replaceAll("_"," ")}</h2>
        <p className="mt-2 text-sm text-slate-200">{[report.parish,report.subcounty,report.district].filter(Boolean).join(" · ") || "Location unavailable"}</p>
        <p className="mt-1 text-xs text-slate-300">GPS accuracy: {report.accuracyM ? `±${Math.round(report.accuracyM)} m` : "not provided"} · {report.verified ? "Verified" : "Unverified"}</p>
        {report.latitude !== undefined && report.longitude !== undefined && <a className="mt-2 inline-block underline" href={`https://maps.google.com/?q=${report.latitude},${report.longitude}`} target="_blank" rel="noreferrer">📍 Open location</a>}
        {report.notes.length > 0 && <div className="mt-4 space-y-2 rounded-2xl bg-white/10 p-3 text-sm">{report.notes.map(n => <p key={n._id}><strong>{n.author === "citizen" ? "Reporter" : "Police"}:</strong> {n.body}{n.url && <> · <a className="underline" href={n.url} target="_blank" rel="noreferrer">attachment</a></>}</p>)}</div>}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {([["verify","✅ Verify"],["assign_me","👮 Assign to me"],["en_route","🚓 En route"],["close","✔️ Close"],["duplicate","🧩 Duplicate"],["false","⚠️ False/spam"]] as const).map(([key,label])=><button key={key} onClick={()=>void action({reportId:report._id,action:key})} className="min-h-12 rounded-xl bg-white px-3 text-sm font-bold text-[#102a43]">{label}</button>)}
        </div>
        <div className="mt-4 flex gap-2"><input aria-label="Reply to reporter" value={reply[report._id] || ""} onChange={e=>setReply(old=>({...old,[report._id]:e.target.value}))} placeholder="Anonymous reply…" className="min-w-0 flex-1 rounded-xl bg-white p-3 text-slate-900" /><button onClick={async()=>{const body=reply[report._id]?.trim();if(body){await sendReply({reportId:report._id,body});setReply(old=>({...old,[report._id]:""}));}}} className="min-h-12 rounded-xl bg-cyan-300 px-4 font-bold text-[#102a43]">Reply</button></div>
      </div><p className="mt-5 text-center text-xs text-slate-300">Tracking {report.trackingCode} · {report.stationId ? "Station routed" : "Station not assigned"}</p>
    </section>)}
  </main>;
}
