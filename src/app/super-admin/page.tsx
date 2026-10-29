"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AuthPanel from "@/components/AuthPanel";

export default function SuperAdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const users = useQuery(api.superAdmin.listUsers, isAuthenticated && profile?.role === "super_admin" ? {} : "skip");
  const setActive = useMutation(api.superAdmin.setUserActive);
  const setRole = useMutation(api.superAdmin.setUserRole);
  const [message, setMessage] = useState("");
  if (isLoading) return <main className="p-6">Loading…</main>;
  if (!isAuthenticated || !profile) return <main className="mx-auto max-w-xl p-5"><h1 className="mb-4 text-2xl font-black">Super-admin sign in</h1><AuthPanel enabled /></main>;
  if (profile.role !== "super_admin") return <main className="p-6">⛔ Super-admin access only.</main>;
  return <main className="mx-auto min-h-screen max-w-4xl p-4 text-[#102a43] sm:p-8">
    <h1 className="text-2xl font-black">🛡️ Super-admin · User management</h1>
    <p className="mt-2 text-sm text-slate-600">New users register through the citizen app, then you can assign an appropriate role here. Disabling an account blocks access without deleting the audit trail.</p>
    <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"><strong>Password reset:</strong> email-based reset is not enabled in this deployment. Configure and verify a transactional email provider before enabling reset links; never set or view another user's password directly.</div>
    {message && <p role="status" className="mt-3 rounded-lg bg-slate-100 p-3">{message}</p>}
    <div className="mt-5 space-y-3">{users?.map(user=><article key={user._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">{user.displayName}</h2><p className="text-sm text-slate-500">{user.district || "No district"} · {user.station || "No station"}</p><p className="mt-1 text-xs">{user.isActive ? "🟢 Active" : "🔴 Disabled"} · {user.badgeNumber || "No badge"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{user.role}</span></div>
      <div className="mt-3 flex flex-wrap gap-2"><select aria-label={`Role for ${user.displayName}`} disabled={user.role === "super_admin"} defaultValue={user.role === "super_admin" ? "admin" : user.role} onChange={async e=>{try{await setRole({userId:user._id,role:e.target.value as "citizen"|"officer"|"admin"});setMessage("Role updated.");}catch(err){setMessage(err instanceof Error?err.message:"Could not update role.");}}} className="min-h-11 rounded-lg border p-2"><option value="citizen">Citizen</option><option value="officer">Officer</option><option value="admin">Admin</option></select>
      <button disabled={user.role === "super_admin"} onClick={async()=>{try{await setActive({userId:user._id,isActive:!user.isActive});setMessage(user.isActive?"Account disabled.":"Account enabled.");}catch(err){setMessage(err instanceof Error?err.message:"Could not update account.");}}} className="min-h-11 rounded-lg bg-[#102a43] px-4 font-bold text-white">{user.isActive ? "Disable account" : "Enable account"}</button></div>
    </article>)}</div>
    {users?.length === 0 && <p className="mt-5">No user profiles yet.</p>}
    <a href="/" className="mt-6 inline-block font-bold underline">← Citizen app</a>
  </main>;
}
