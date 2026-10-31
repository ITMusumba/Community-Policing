"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import PoliceShell from "@/components/PoliceShell";
import { CATEGORY_LABEL, elapsed } from "@/lib/police";

export default function DashboardPage() {
  return <PoliceShell active="dashboard">{() => <Dashboard />}</PoliceShell>;
}

const fmtMin = (m: number | null) => (m === null ? "—" : elapsed(m * 60_000));
const fmtHrs = (h: number | null) => (h === null ? "—" : elapsed(h * 3_600_000));

function Dashboard() {
  const [district, setDistrict] = useState("");
  const [days, setDays] = useState(30);
  const data = useQuery(api.dashboard.summary, { district: district || undefined, days });

  if (data === undefined) return <p className="p-6 text-sm text-slate-600">Loading statistics…</p>;
  const t = data.totals;
  const tiles: { label: string; value: string | number; alert?: boolean }[] = [
    { label: "Incidents received", value: t.received },
    { label: "Open", value: t.open },
    { label: "Overdue (no response)", value: t.overdue, alert: t.overdue > 0 },
    { label: "P1 open", value: t.p1Open, alert: t.p1Open > 0 },
    { label: "Median first response", value: fmtMin(t.medianResponseMin) },
    { label: "Median time to close", value: fmtHrs(t.medianResolveHrs) },
    { label: "Closed", value: t.closed },
    { label: "Duplicate / unfounded", value: t.rejected },
  ];
  const sel = "min-h-10 rounded border border-slate-300 bg-white px-2 text-sm";

  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Operations dashboard</h1><p className="text-sm text-slate-600">{data.scope} · last {data.days} days · updates live</p></div>
      <div className="flex gap-2">
        {data.districts.length > 0 && <select aria-label="District" value={district} onChange={e => setDistrict(e.target.value)} className={sel}><option value="">All districts</option>{data.districts.map(d => <option key={d}>{d}</option>)}</select>}
        <select aria-label="Period" value={days} onChange={e => setDays(Number(e.target.value))} className={sel}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={365}>Last 12 months</option></select>
      </div>
    </div>
    {data.capped && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">Showing the most recent 2,000 incidents in this period.</p>}

    <section aria-label="Summary" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map(x => <div key={x.label} className={`rounded border bg-white p-3 ${x.alert ? "border-red-300" : "border-slate-300"}`}>
        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-600">{x.alert && <AlertTriangle size={13} className="text-red-700" aria-label="Needs attention" />}{x.label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${x.alert ? "text-red-800" : "text-slate-900"}`}>{x.value}</p>
      </div>)}
    </section>

    <Panel title="Performance by station">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-3 py-2">Station</th><th className="px-3 py-2 text-right">Open</th><th className="px-3 py-2 text-right">Overdue</th><th className="px-3 py-2 text-right">Closed</th><th className="hidden px-3 py-2 text-right sm:table-cell">Total</th><th className="px-3 py-2 text-right">Median response</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{data.stations.length === 0 ? <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No incidents in this period.</td></tr> : data.stations.map(s => <tr key={s.name}>
          <td className="px-3 py-2">{s.name}</td><td className="px-3 py-2 text-right tabular-nums">{s.open}</td>
          <td className={`px-3 py-2 text-right tabular-nums ${s.overdue ? "font-semibold text-red-800" : ""}`}>{s.overdue}</td>
          <td className="px-3 py-2 text-right tabular-nums">{s.closed}</td><td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{s.total}</td>
          <td className="px-3 py-2 text-right tabular-nums">{fmtMin(s.medianResponseMin)}</td></tr>)}</tbody>
      </table>
    </Panel>

    <div className="grid gap-5 md:grid-cols-2">
      <Panel title="Incidents by category"><BarTable rows={data.categories.map(c => ({ label: CATEGORY_LABEL[c.category] ?? c.category, count: c.count }))} /></Panel>
      <Panel title="Hotspots (top 10 locations)"><BarTable rows={data.hotspots.map(h => ({ label: h.place, count: h.count }))} /></Panel>
    </div>
    <p className="text-xs text-slate-500">Overdue = open incidents with no police response within the priority target (P1 30 min, P2 2 h, P3 24 h, P4 72 h).</p>
  </main>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded border border-slate-300 bg-white"><h2 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">{title}</h2><div className="overflow-x-auto">{children}</div></section>;
}

/** Table with an inline single-hue bar per row; the number is always shown as text. */
function BarTable({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  if (!rows.length) return <p className="px-3 py-4 text-center text-sm text-slate-500">No incidents in this period.</p>;
  return <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">{rows.map(r => <tr key={r.label} title={`${r.label}: ${r.count}`}>
    <td className="w-2/5 px-3 py-2">{r.label}</td>
    <td className="px-3 py-2"><div className="h-3 rounded-r bg-[#1e3a5f]" style={{ width: `${(r.count / max) * 100}%`, minWidth: 4 }} /></td>
    <td className="w-12 px-3 py-2 text-right tabular-nums">{r.count}</td></tr>)}</tbody></table>;
}
