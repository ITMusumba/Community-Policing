"use client";

import { useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function ChangePassword({ required = false, onDone }: { required?: boolean; onDone?: () => void }) {
  const change = useAction(api.staffAccounts.changeOwnPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ ok: false, text: "The new passwords do not match." }); return; }
    setBusy(true);
    try {
      await change({ currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      setMsg({ ok: true, text: "Password changed." });
      onDone?.();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message.replace(/^.*Uncaught ConvexError: /, "").split("\n")[0] : "Could not change password." });
    } finally { setBusy(false); }
  }

  const field = "mt-1 min-h-11 w-full rounded border border-slate-300 bg-white px-3";
  return <form onSubmit={submit} className="space-y-3 rounded border border-slate-300 bg-white p-4 text-sm">
    <h2 className="text-lg font-semibold">{required ? "Set your own password" : "Change password"}</h2>
    {required && <p className="text-slate-600">You signed in with a one-time password from your administrator. Choose your own before continuing.</p>}
    <label className="block">{required ? "One-time password" : "Current password"}<input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={field} /></label>
    <label className="block">New password (at least 10 characters)<input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={e => setNext(e.target.value)} className={field} /></label>
    <label className="block">Repeat new password<input type="password" autoComplete="new-password" required minLength={10} value={confirm} onChange={e => setConfirm(e.target.value)} className={field} /></label>
    {msg && <p role={msg.ok ? "status" : "alert"} className={`rounded px-3 py-2 ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}
    <button disabled={busy} className="min-h-11 rounded bg-[#0b1f33] px-4 font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save password"}</button>
  </form>;
}
