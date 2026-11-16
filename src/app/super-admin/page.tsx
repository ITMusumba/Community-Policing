"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowRightLeft, ArrowUp, ChevronDown, ChevronUp, FileText, KeyRound, Lock, Plus, Tags, UserPlus, UserX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import PoliceShell from "@/components/PoliceShell";
import StationOptions from "@/components/StationOptions";
import { errorMessage } from "@/lib/errors";
import { PRIORITY, STATUS_LABEL, type Priority } from "@/lib/police";
import { CategoryIcon, useCategories, type CategoryDef } from "@/lib/categories";

type User = FunctionReturnType<typeof api.superAdmin.listUsers>[number];
const ROLE_LABEL: Record<string, string> = { citizen: "Citizen", officer: "Officer", admin: "Commander / Admin", super_admin: "Super-admin" };
const HANDOVER_REASONS = ["Officer relieved of duty", "Officer transferred", "Officer on leave", "Officer suspended pending inquiry", "Workload redistribution"];
const btn = "flex min-h-10 items-center justify-center gap-1.5 rounded border px-3 text-sm font-medium disabled:opacity-40";
const fmt = (t: number) => new Date(t).toLocaleString("en-UG", { dateStyle: "medium", timeStyle: "short" });

export default function SuperAdminPage() {
  // Commanders/admins manage incident categories; personnel administration stays with super-admins.
  return <PoliceShell active="admin">{profile => profile.role === "super_admin"
    ? <><Administration selfId={profile._id} /><div className="mx-auto max-w-4xl px-4 pb-8"><Categories /></div></>
    : profile.role === "admin"
      ? <div className="mx-auto max-w-4xl px-4 py-4"><Categories /></div>
      : <p className="p-6 text-sm text-slate-700">Administrator access only.</p>}</PoliceShell>;
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
    <AddStaff />
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
    <StationReview />
  </main>;
}

const STATIONS_PER_PAGE = 15;

/** Stations imported from OpenStreetMap show as "unconfirmed" until checked and verified here. */
function StationReview() {
  const stations = useQuery(api.superAdmin.listStationsForReview, {});
  const setVerified = useMutation(api.superAdmin.setStationsVerified);
  const remove = useMutation(api.superAdmin.deleteStation);
  const [district, setDistrict] = useState("");
  const [search, setSearch] = useState("");
  const [showVerified, setShowVerified] = useState(false);
  const [page, setPage] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const q = search.trim().toLowerCase();
  const inView = (stations ?? []).filter(s => s.verified === showVerified);
  // District dropdown with a count of stations in the current view (unconfirmed or verified).
  const districtCounts = [...inView.reduce((m, s) => m.set(s.district, (m.get(s.district) ?? 0) + 1), new Map<string, number>())].sort((a, b) => a[0].localeCompare(b[0]));
  const matching = inView.filter(s => (!district || s.district === district) && (!q || s.name.toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(matching.length / STATIONS_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * STATIONS_PER_PAGE, (current + 1) * STATIONS_PER_PAGE);
  const pending = (stations ?? []).filter(s => !s.verified).length;
  const resetPage = () => setPage(0);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorMessage(e, "Action failed.") }); }
  }

  return <section className="space-y-2 pt-4">
    <div><h2 className="text-lg font-semibold">Police stations</h2><p className="text-sm text-slate-600">{pending} unconfirmed. Unconfirmed stations already appear on the map, faded and marked &quot;unconfirmed&quot;. Check the name and location, then verify.</p></div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <select aria-label="District" value={district} onChange={e => { setDistrict(e.target.value); resetPage(); }} className="min-h-11 w-full min-w-0 rounded border border-slate-300 bg-white px-2 text-sm">
        <option value="">All districts ({inView.length})</option>
        {districtCounts.map(([d, n]) => <option key={d} value={d}>{d} ({n})</option>)}
      </select>
      <input aria-label="Search station name" placeholder="Search station name" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} className="min-h-11 w-full min-w-0 rounded border border-slate-300 bg-white px-2 text-sm" />
      <div className="flex rounded border border-slate-300 bg-white p-0.5 text-sm sm:col-span-2">
        {([false, true] as const).map(v => <button key={String(v)} onClick={() => { setShowVerified(v); resetPage(); }} aria-pressed={showVerified === v} className={`min-h-10 flex-1 rounded ${showVerified === v ? "bg-slate-800 font-medium text-white" : "text-slate-700"}`}>{v ? "Verified" : `Unconfirmed (${pending})`}</button>)}
      </div>
    </div>
    {msg && <p role="status" className={`rounded px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}
    {!stations && <p className="text-sm text-slate-600">Loading stations…</p>}
    <ul className="space-y-1.5">{shown.map(s => <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-300 bg-white px-3 py-2">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{s.name}</p><p className="text-xs text-slate-600">{s.type.replaceAll("_", " ")} · {s.district} · {s.subcounty} · <a className="underline" href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=17/${s.lat}/${s.lng}`} target="_blank" rel="noreferrer">view on map</a></p></div>
      <div className="flex gap-2">
        <button onClick={() => void act(() => setVerified({ stationIds: [s._id], verified: !s.verified }), s.verified ? "Station unverified." : "Station verified.")} className={`${btn} border-slate-300 bg-white`}>{s.verified ? "Unverify" : "Verify"}</button>
        <button onClick={() => { if (confirm(`Delete ${s.name}?`)) void act(() => remove({ stationId: s._id }), "Station deleted."); }} className={`${btn} border-red-300 bg-white text-red-800`}>Delete</button>
      </div>
    </li>)}</ul>
    {stations && !shown.length && <p className="text-sm text-slate-600">No {showVerified ? "verified" : "unconfirmed"} stations match.</p>}
    {matching.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <button disabled={current === 0} onClick={() => setPage(current - 1)} className={`${btn} border-slate-300 bg-white`}>← Previous</button>
      <span className="text-slate-600">{current * STATIONS_PER_PAGE + 1}–{current * STATIONS_PER_PAGE + shown.length} of {matching.length} · page {current + 1}/{pages}</span>
      <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className={`${btn} border-slate-300 bg-white`}>Next →</button>
    </div>}
    {shown.length > 0 && <button onClick={() => void act(() => setVerified({ stationIds: shown.map(s => s._id), verified: !showVerified }), `${shown.length} stations ${showVerified ? "unverified" : "verified"}.`)} className={`${btn} w-full border-slate-800 bg-slate-800 text-white`}>{showVerified ? "Unverify" : "Verify"} all {shown.length} on this page</button>}
  </section>;
}

function UserPanel({ user, users, selfId }: { user: User; users: User[]; selfId: Id<"userProfiles"> }) {
  const isStaff = user.role !== "citizen";
  const record = useQuery(api.superAdmin.officerRecord, isStaff ? { userId: user._id } : "skip");
  const stations = useQuery(api.reports.publicStations, {});
  const setRole = useMutation(api.superAdmin.setUserRole);
  const setActive = useMutation(api.superAdmin.setUserActive);
  const setDetails = useMutation(api.superAdmin.setOfficerDetails);
  const handover = useMutation(api.superAdmin.handoverCases);
  const resetPassword = useAction(api.staffAccounts.resetStaffPassword);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
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
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: errorMessage(e, "Action failed.") }); }
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
      {user.role !== "citizen" && !locked && <div className="sm:col-span-2">
        <button onClick={() => void act(async () => { const r = await resetPassword({ profileId: user._id }); setIssued(r); }, "New one-time password issued. The officer has been signed out everywhere.")} className={`${btn} border-slate-300 bg-white`}><KeyRound size={15} aria-hidden="true" />Reset password</button>
        {issued && <OneTimePassword email={issued.email} password={issued.password} onClose={() => setIssued(null)} />}
      </div>}
      {(user.role === "officer" || user.role === "admin") && <>
        <label className="block"><span className="text-xs uppercase tracking-wide text-slate-600">Station</span>
          <select value={stationId} onChange={e => setStationId(e.target.value)} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-2"><option value="">No station</option><StationOptions stations={stations} /></select></label>
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
  const { formal } = useCategories();
  if (!cases.length) return <p className="text-slate-500">{empty}</p>;
  return <div className="overflow-x-auto rounded border border-slate-300 bg-white"><table className="w-full text-xs">
    <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-600"><tr><th className="px-2 py-1.5">Reference</th><th className="px-2 py-1.5">Pri.</th><th className="px-2 py-1.5">Category</th><th className="px-2 py-1.5">Status</th><th className="hidden px-2 py-1.5 sm:table-cell">Location</th><th className="px-2 py-1.5">Received</th></tr></thead>
    <tbody className="divide-y divide-slate-100">{cases.map(c => <tr key={c._id}>
      <td className="px-2 py-1.5 font-mono">{c.ref}</td><td className="px-2 py-1.5">{PRIORITY[c.priority as Priority].short}</td>
      <td className="px-2 py-1.5">{formal(c.category)}</td><td className="px-2 py-1.5">{STATUS_LABEL[c.status as keyof typeof STATUS_LABEL] ?? c.status}</td>
      <td className="hidden px-2 py-1.5 sm:table-cell">{c.place || "—"}</td><td className="px-2 py-1.5 whitespace-nowrap">{fmt(c.createdAt)}</td></tr>)}</tbody>
  </table></div>;
}

function OneTimePassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return <div role="status" className="mt-2 rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm">
    <p className="font-semibold">One-time sign-in details — shown only once</p>
    <p className="mt-1">Email: <span className="font-mono">{email}</span></p>
    <p>Password: <span className="font-mono text-base tracking-wider">{password}</span></p>
    <p className="mt-1 text-xs text-slate-700">Give these to the officer in person, not by public message. They sign in at <span className="font-mono">/police/login</span> and must set their own password straight away.</p>
    <div className="mt-2 flex gap-2">
      <button onClick={() => void navigator.clipboard?.writeText(`Email: ${email}
One-time password: ${password}
Sign in: ${window.location.origin}/police/login`)} className={`${btn} border-slate-300 bg-white`}>Copy</button>
      <button onClick={onClose} className={`${btn} border-slate-300 bg-white`}>Done</button>
    </div>
  </div>;
}

/** Police and admin accounts are created here only; the public sign-up page makes citizen accounts. */
function AddStaff() {
  const create = useAction(api.staffAccounts.createStaffAccount);
  const stations = useQuery(api.reports.publicStations, {});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ displayName: "", email: "", role: "officer" as "officer" | "admin", badgeNumber: "", stationId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await create({ displayName: form.displayName, email: form.email, role: form.role, badgeNumber: form.badgeNumber || undefined, stationId: (form.stationId || undefined) as Id<"stations"> | undefined });
      setIssued(r);
      setForm({ displayName: "", email: "", role: "officer", badgeNumber: "", stationId: "" });
    } catch (err) {
      setError(errorMessage(err, "Could not create the account."));
    } finally { setBusy(false); }
  }

  const field = "min-h-11 w-full min-w-0 rounded border border-slate-300 bg-white px-2 text-sm";
  return <section className="rounded border border-slate-300 bg-white">
    <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-semibold"><UserPlus size={16} aria-hidden="true" />Add police officer or administrator</button>
    {issued && <div className="px-3 pb-3"><OneTimePassword email={issued.email} password={issued.password} onClose={() => setIssued(null)} /></div>}
    {open && <form onSubmit={submit} className="grid grid-cols-1 gap-2 border-t border-slate-200 p-3 sm:grid-cols-2">
      <input required minLength={2} placeholder="Full name" aria-label="Full name" value={form.displayName} onChange={set("displayName")} className={field} />
      <input required type="email" placeholder="Email (used to sign in)" aria-label="Email" value={form.email} onChange={set("email")} className={field} />
      <select aria-label="Role" value={form.role} onChange={set("role")} className={field}><option value="officer">Officer</option><option value="admin">Commander / Admin</option></select>
      <input placeholder="Badge / force number" aria-label="Badge number" value={form.badgeNumber} onChange={set("badgeNumber")} className={field} />
      <select aria-label="Station" value={form.stationId} onChange={set("stationId")} className={`${field} sm:col-span-2`}><option value="">Station (optional)</option><StationOptions stations={stations} /></select>
      {error && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2">{error}</p>}
      <button disabled={busy} className={`${btn} border-slate-800 bg-slate-800 text-white sm:col-span-2`}>{busy ? "Creating…" : "Create account"}</button>
    </form>}
  </section>;
}

// Emoji that show on Android 9 and newer (Emoji 11 or older), offered as quick picks.
const EMOJI_PICKS = ["🗑️", "🚯", "🌳", "🌲", "🔥", "💧", "🌊", "☠️", "🏭", "💨", "⛏️", "🚜", "🚛", "🏗️", "🚧", "🐟", "🐊", "🐘", "🦏", "🐒", "🦁", "🦜", "🏹", "📢", "🛍️", "🧪", "🐄", "🐐", "🌾", "🏠", "🚗", "💰", "💊", "🔪", "⚠️", "❔"];
const GROUP_LABEL = { environment: "Environmental", general: "Other crime" } as const;
type Draft = { key?: string; label: string; emoji: string; group: CategoryDef["group"]; priority: Priority; main: boolean; active: boolean };
const EMPTY: Draft = { label: "", emoji: "", group: "environment", priority: "p3", main: true, active: true };

/** Incident types citizens pick from on "What happened?". Built-in ones can be renamed, re-pictured, moved or hidden. */
function Categories() {
  const cats = useCategories();
  const save = useMutation(api.categories.save);
  const reset = useMutation(api.categories.resetBuiltin);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const field = "min-h-11 w-full min-w-0 rounded border border-slate-300 bg-white px-2 text-sm";

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: done }); setDraft(null); }
    catch (e) { setMsg({ ok: false, text: errorMessage(e, "Could not save the category.") }); }
    finally { setBusy(false); }
  }
  const asArgs = (c: CategoryDef) => ({ key: c.key, label: c.label, emoji: c.emoji, group: c.group, priority: c.priority, main: c.main, active: c.active, order: c.order });
  // Swap places with the neighbour in the same list.
  function move(list: CategoryDef[], i: number, by: -1 | 1) {
    const a = list[i], b = list[i + by];
    if (!a || !b) return;
    void run(async () => { await save({ ...asArgs(a), order: b.order }); await save({ ...asArgs(b), order: a.order === b.order ? a.order + by : a.order }); }, `Moved ${a.label}.`);
  }

  const section = (title: string, list: CategoryDef[]) => <div>
    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
    <ul className="divide-y divide-slate-100 rounded border border-slate-300 bg-white">{list.map((c, i) => <li key={c.key} className={`flex items-center gap-2 px-2 py-1.5 ${c.active ? "" : "opacity-50"}`}>
      <span className="flex w-12 shrink-0 justify-center"><CategoryIcon cat={c} size="sm" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.label}{!c.active && <span className="text-xs text-slate-500"> · hidden</span>}</p>
        <p className="truncate text-xs text-slate-500">{GROUP_LABEL[c.group]} · {PRIORITY[c.priority].short}{c.builtin ? "" : " · added"}</p>
      </div>
      <button disabled={busy || i === 0} onClick={() => move(list, i, -1)} aria-label={`Move ${c.label} up`} className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 disabled:opacity-30"><ArrowUp size={14} /></button>
      <button disabled={busy || i === list.length - 1} onClick={() => move(list, i, 1)} aria-label={`Move ${c.label} down`} className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 disabled:opacity-30"><ArrowDown size={14} /></button>
      <button onClick={() => { setMsg(null); setDraft({ key: c.key, label: c.label, emoji: c.emoji, group: c.group, priority: c.priority, main: c.main, active: c.active }); }} className={`${btn} border-slate-300 bg-white`}>Edit</button>
    </li>)}</ul>
  </div>;

  const editing = draft?.key ? cats.byKey.get(draft.key) : undefined;
  return <section className="space-y-3 pt-6">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Tags size={18} aria-hidden="true" />Incident categories</h2>
        <p className="text-sm text-slate-600">The pictures citizens tap on &ldquo;What happened?&rdquo;. &ldquo;Shown first&rdquo; appear straight away; the rest are under &ldquo;See more&rdquo;. Every change is audit-logged.</p></div>
      <button onClick={() => { setMsg(null); setDraft({ ...EMPTY }); }} className={`${btn} border-slate-800 bg-slate-800 text-white`}><Plus size={15} aria-hidden="true" />Add category</button>
    </div>
    {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}

    {draft && <form onSubmit={e => { e.preventDefault(); void run(() => save({ key: draft.key, label: draft.label, emoji: draft.emoji, group: draft.group, priority: draft.priority, main: draft.main, active: draft.active }), draft.key ? "Category updated." : "Category added."); }}
      className="space-y-2 rounded border-2 border-slate-400 bg-white p-3">
      <p className="font-semibold">{draft.key ? `Edit “${editing?.label ?? draft.label}”` : "New category"}</p>
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-300 bg-slate-50">{draft.emoji ? <CategoryIcon cat={{ key: draft.key ?? "", emoji: draft.emoji }} size="lg" /> : <span className="text-xs text-slate-400">Picture</span>}</span>
        <div className="grid flex-1 gap-2 sm:grid-cols-2">
          <input required minLength={2} maxLength={40} placeholder="Name citizens see, e.g. Charcoal burning" aria-label="Name" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} className={field} />
          <input required maxLength={24} placeholder="Emoji, e.g. 🌳🔥" aria-label="Emoji" value={draft.emoji} onChange={e => setDraft({ ...draft, emoji: e.target.value })} className={`${field} text-xl`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Quick emoji picks">{EMOJI_PICKS.map(e => <button type="button" key={e} onClick={() => setDraft({ ...draft, emoji: (draft.emoji.length < 8 ? draft.emoji : "") + e })} className="h-10 w-10 rounded border border-slate-200 text-xl hover:bg-slate-100">{e}</button>)}
        <button type="button" onClick={() => setDraft({ ...draft, emoji: "" })} className="h-10 rounded border border-slate-200 px-2 text-xs">Clear</button></div>
      <p className="text-xs text-slate-500">Use one or two pictures that someone who cannot read would recognise. Newer emoji may show as empty boxes on older phones.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select aria-label="Group" value={draft.group} onChange={e => setDraft({ ...draft, group: e.target.value as Draft["group"] })} className={field}><option value="environment">Environmental crime</option><option value="general">Other crime</option></select>
        <select aria-label="Starting priority" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Priority })} className={field}>{(Object.keys(PRIORITY) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}</select>
        <select aria-label="Placement" value={draft.main ? "main" : "more"} onChange={e => setDraft({ ...draft, main: e.target.value === "main" })} className={field}><option value="main">Shown first</option><option value="more">Under &ldquo;See more&rdquo;</option></select>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} disabled={draft.key === "other"} onChange={e => setDraft({ ...draft, active: e.target.checked })} className="h-5 w-5" />Visible to citizens{draft.key === "other" && " (Other is always visible)"}</label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={`${btn} border-slate-800 bg-slate-800 text-white`}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setDraft(null)} className={`${btn} border-slate-300 bg-white`}>Cancel</button>
        {editing?.builtin && <button type="button" disabled={busy} onClick={() => void run(() => reset({ key: editing.key }), "Category reset to the original.")} className={`${btn} border-slate-300 bg-white`}>Reset to original</button>}
      </div>
    </form>}

    {section("Shown first", cats.all.filter(c => c.main))}
    {section("Under “See more”", cats.all.filter(c => !c.main))}
  </section>;
}
