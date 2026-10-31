"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRightLeft, ChevronDown, ChevronUp, FileText, Lock, UserX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import PoliceShell from "@/components/PoliceShell";
import { CATEGORY_LABEL, PRIORITY, STATUS_LABEL, type Priority } from "@/lib/police";

type User = FunctionReturnType<typeof api.superAdmin.listUsers>[number];
const ROLE_LABEL: Record<string, string> = { citizen: "Citizen", officer: "Officer", admin: "Commander / Admin", super_admin: "Super-admin" };
const HANDOVER_REASONS = ["Officer relieved of duty", "Officer transferred", "Officer on leave", "Officer suspended pending inquiry", "Workload redistribution"];
const btn = "flex min-h-10 items-center justify-center gap-1.5 rounded border px-3 text-sm font-medium disabled:opacity-40";
const fmt = (t: number) => new Date(t).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" });

export default function SuperAdminPage() {
  return <PoliceShell active="admin">{profile => profile.role === "super_admin"
    ? <Administration selfId={profile._id} />
    : <p className="p-6 text-sm text-slate-700">Super-admin access only.</p>}</PoliceShell>;
}

function Administration({ selfId }: { selfId: Id<"userProfiles"> }) {
  const users = useQuery(api.superAdmin.listUsers, {});
  const [filter, setFilter] = useState<"staff" | "all">("staff");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = (users ?? []).filter(u => filter === "all" || u.role !== "citizen").sort((a, b) => a.displayName.localeCompare(b.displayName));

  return <main className="mx-auto max-w-4xl space-y-4 px-4 py-4">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h1 className="text-xl font-semibold">Personnel administration</h1><p className="text-sm text-slate-600">Roles, stations, badge numbers, case handover and account status. Every change is audit-logged.</p></div>
      <select aria-label="Show" value={filter} onChange={e => setFilter(e.target.value as "staff" | "all")} className="min-h-10 rounded border border-slate-300 bg-white px-2 text-sm"><option value="staff">Police personnel</option><option value="all">All accounts</option></select>
    </div>
    <p className="flex items-start gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"><Lock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />Passwords are never stored in readable form and cannot be viewed. When an officer leaves, hand over their open cases and disable the account; their record stays under their name.</p>
    {!users && <p className="text-sm text-slate-600">Loading personnel…</p>}
    <ul className="space-y-2">{shown.map(u => <li key={u._id} className="overflow-hidden rounded border border-slate-300 bg-white">
      <button onClick={() => setOpenId(openId === u._id ? null : u._id)} aria-expanded={openId === u._id} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
        <div className="min-w-0">
          <p className="truncate font-medium">{u.displayName}{u.badgeNumber && <span className="text-slate-500"> · {u.badgeNumber}</span>}</p>
          <p className="truncate text-xs text-slate-600">{ROLE_LABEL[u.role]} · {u.station ?? "No station"}{u.district ? `, ${u.district}` : ""}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {u.role !== "citizen" && <span className={`rounded px-1.5 py-0.5 ${u.openCases ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}`}>{u.openCases} open</span>}
          <span className={`rounded border px-1.5 py-0.5 ${u.isActive ? "border-slate-300 text-slate-700" : "border-red-300 bg-red-50 text-red-800"}`}>{u.isActive ? "Active" : "Disabled"}</span>
          {openId === u._id ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </div>
      </button>
      {openId === u._id && <UserPanel user={u} users={users ?? []} selfId={selfId} />}
    </li>)}</ul>
  </main>;
}

function UserPanel({ user, users, selfId }: { user: User; users: User[]; selfId: Id<"userProfiles"> }) {
  const isStaff = user.role !== "citizen";
  const record = useQuery(api.superAdmin.officerRecord, isStaff ? { userId: user._id } : "skip");
  const stations = useQuery(api.reports.publicStations, {});
  const setRole = useMutation(api.superAdmin.setUserRole);
  const setActive = useMutation(api.superAdmin.setUserActive);
  const setDetails = useMutation(api.superAdmin.setOfficerDetails);
  const handover = useMutation(api.superAdmin.handoverCases);
  const [stationId, setStationId] = useState<string>(user.stationId ?? "");
  const [badge, setBadge] = useState(user.badgeNumber ?? "");
  const [toId, setToId] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [disable, setDisable] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = user.role === "super_admin" || user._id === selfId;
  const receivers = users.filter(u => u._id !== user._id && u.isActive && u.role !== "citizen");

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Action failed." }); }
  }

  return <div className="space-y-4 border-t border-slate-200 bg-slate-50 px-3 py-3 text-sm">
    {msg && <p role="status" className={`rounded px-3 py-2 ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}

    <section className="grid gap-2 sm:grid-cols-2">
      <label className="block"><span className="text-xs uppercase tracking-wide text-slate-600">Role</span>
        <select disabled={locked} value={user.role === "super_admin" ? "admin" : user.role} onChange={e => void act(() => setRole({ userId: user._id, role: e.target.value as "citizen" | "officer" | "admin" }), "Role updated.")} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-2">
          <option value="citizen">Citizen</option><option value="officer">Officer</option><option value="admin">Commander / Admin</option></select></label>
      <div className="flex items-end">
        <button disabled={locked} onClick={() => void act(() => setActive({ userId: user._id, isActive: !user.isActive }), user.isActive ? "Account disabled." : "Account re-enabled.")} className={`${btn} w-full ${user.isActive ? "border-red-300 text-red-800" : "border-slate-800 bg-slate-800 text-white"}`}>
          <UserX size={15} aria-hidden="true" />{user.isActive ? "Disable account" : "Re-enable account"}</button>
      </div>
      {(user.role === "officer" || user.role === "admin") && <>
        <label className="block"><span className="text-xs uppercase tracking-wide text-slate-600">Station</span>
          <select value={stationId} onChange={e => setStationId(e.target.value)} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-2"><option value="">No station</option>{stations?.map(s => <option key={s._id} value={s._id}>{s.name} · {s.district}</option>)}</select></label>
        <label className="block"><span className="text-xs uppercase tracking-wide text-slate-600">Badge number</span>
          <div className="mt-1 flex gap-2"><input value={badge} onChange={e => setBadge(e.target.value)} className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2" />
            <button onClick={() => void act(() => setDetails({ userId: user._id, stationId: (stationId || undefined) as Id<"stations"> | undefined, badgeNumber: badge || undefined }), "Station and badge saved.")} className={`${btn} border-slate-800 bg-slate-800 text-white`}>Save</button></div></label>
      </>}
    </section>

    {isStaff && !record && <p className="text-slate-600">Loading service record…</p>}
    {record && <>
      <section>
        <h3 className="mb-1 font-semibold">Open cases held ({record.openCases.length})</h3>
        <CaseTable cases={record.openCases} empty="No open cases." />
      </section>

      {record.openCases.length > 0 || user.isActive ? <section className="rounded border border-slate-400 bg-white p-3">
        <h3 className="flex items-center gap-1.5 font-semibold"><ArrowRightLeft size={15} aria-hidden="true" />Hand over cases</h3>
        <p className="mt-0.5 text-xs text-slate-600">Moves all {record.openCases.length} open case(s) to another officer. Each case records the handover in its occurrence log; the reporter&apos;s tracking code keeps working.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select aria-label="Receiving officer" value={toId} onChange={e => setToId(e.target.value)} className="min-h-10 rounded border border-slate-300 bg-white px-2"><option value="">Receiving officer (required)</option>{receivers.map(r => <option key={r._id} value={r._id}>{r.displayName}{r.badgeNumber ? ` (${r.badgeNumber})` : ""} · {r.station ?? "No station"}</option>)}</select>
          <select aria-label="Reason" value={reason} onChange={e => setReason(e.target.value)} className="min-h-10 rounded border border-slate-300 bg-white px-2"><option value="">Reason (required)</option>{HANDOVER_REASONS.map(x => <option key={x}>{x}</option>)}</select>
          <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Remarks / authority reference (optional)" className="min-h-10 rounded border border-slate-300 px-2 sm:col-span-2" />
          {!locked && <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={disable} onChange={e => setDisable(e.target.checked)} className="h-4 w-4" />Also disable this account</label>}
        </div>
        {!confirming
          ? <button disabled={!toId || !reason} onClick={() => setConfirming(true)} className={`${btn} mt-2 border-slate-800 bg-slate-800 text-white`}>Hand over…</button>
          : <div className="mt-2 rounded border-2 border-slate-800 p-2">
              <p className="font-medium">Confirm: move {record.openCases.length} case(s) from {record.officer.name} to {receivers.find(r => r._id === toId)?.displayName}{disable && !locked ? " and disable the account" : ""}?</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => void act(async () => { const res = await handover({ fromUserId: user._id, toUserId: toId as Id<"userProfiles">, reason: remarks.trim() ? `${reason}: ${remarks.trim()}` : reason, disableAccount: disable && !locked }); setConfirming(false); setToId(""); setReason(""); setRemarks(""); return res; }, "Handover recorded.")} className={`${btn} border-slate-800 bg-slate-800 text-white`}>Confirm handover</button>
                <button onClick={() => setConfirming(false)} className={`${btn} border-slate-300 bg-white`}>Cancel</button>
              </div>
            </div>}
      </section> : null}

      <details className="rounded border border-slate-300 bg-white">
        <summary className="cursor-pointer px-3 py-2 font-semibold">Closed cases ({record.closedCases.length})</summary>
        <div className="px-3 pb-3"><CaseTable cases={record.closedCases} empty="No closed cases." /></div>
      </details>
      <details className="rounded border border-slate-300 bg-white">
        <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 font-semibold"><FileText size={14} aria-hidden="true" />Activity record (last {record.actions.length})</summary>
        <ol className="divide-y divide-slate-100 font-mono text-xs">{record.actions.length === 0 ? <li className="px-3 py-2 text-slate-500">No recorded actions.</li> : record.actions.map(a => <li key={a._id} className="px-3 py-1.5"><span className="text-slate-500">{fmt(a.createdAt)}</span> — {a.action}{a.entity ? ` — ${a.entity}` : ""}{a.details ? ` — ${a.details}` : ""}</li>)}</ol>
      </details>
    </>}
  </div>;
}

type Case = FunctionReturnType<typeof api.superAdmin.officerRecord>["openCases"][number];
function CaseTable({ cases, empty }: { cases: Case[]; empty: string }) {
  if (!cases.length) return <p className="text-slate-500">{empty}</p>;
  return <div className="overflow-x-auto rounded border border-slate-300 bg-white"><table className="w-full text-xs">
    <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-600"><tr><th className="px-2 py-1.5">Reference</th><th className="px-2 py-1.5">Pri.</th><th className="px-2 py-1.5">Category</th><th className="px-2 py-1.5">Status</th><th className="hidden px-2 py-1.5 sm:table-cell">Location</th><th className="px-2 py-1.5">Received</th></tr></thead>
    <tbody className="divide-y divide-slate-100">{cases.map(c => <tr key={c._id}>
      <td className="px-2 py-1.5 font-mono">{c.ref}</td><td className="px-2 py-1.5">{PRIORITY[c.priority as Priority].short}</td>
      <td className="px-2 py-1.5">{CATEGORY_LABEL[c.category] ?? c.category}</td><td className="px-2 py-1.5">{STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] ?? c.status}</td>
      <td className="hidden px-2 py-1.5 sm:table-cell">{c.place || "—"}</td><td className="px-2 py-1.5 whitespace-nowrap">{fmt(c.createdAt)}</td></tr>)}</tbody>
  </table></div>;
}
