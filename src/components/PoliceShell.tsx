"use client";

import { useEffect, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LayoutDashboard, ListChecks, LogOut, Settings, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import ChangePassword from "@/components/ChangePassword";

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const STAFF = ["officer", "admin", "super_admin"];

/** Shared frame for every police/admin screen: access gate, official header, idle sign-out. */
export default function PoliceShell({ active, children }: { active: "incidents" | "dashboard" | "admin"; children: (profile: Doc<"userProfiles">) => ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const profile = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");

  // Sign out automatically after 15 minutes without activity (shared devices at stations).
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer = window.setTimeout(() => void signOut(), IDLE_LIMIT_MS);
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void signOut(), IDLE_LIMIT_MS); };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => { window.clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [isAuthenticated, signOut]);

  // Signed out or wrong role: go to the matching sign-in page, which explains why and offers sign out.
  const denied = !isLoading && (!isAuthenticated || profile === null || (!!profile && (!STAFF.includes(profile.role) || !profile.isActive)));
  useEffect(() => {
    if (!denied) return;
    const login = active === "admin" ? "/admin/login" : "/police/login";
    window.location.replace(`${login}?next=${encodeURIComponent(window.location.pathname)}`);
  }, [denied, active]);

  if (isLoading || (isAuthenticated && profile === undefined)) return <Frame><p className="p-6 text-sm text-slate-600">Verifying credentials…</p></Frame>;
  if (!isAuthenticated || !profile || !STAFF.includes(profile.role) || !profile.isActive) return <Frame><p className="p-6 text-sm text-slate-600">Redirecting to sign in…</p></Frame>;
  if (profile.mustChangePassword) return <Frame><div className="mx-auto max-w-md p-4"><ChangePassword required /><button onClick={() => void signOut()} className="mt-3 text-sm underline">Sign out</button></div></Frame>;

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";
  const tab = (href: string, label: string, Icon: typeof ListChecks, on: boolean) =>
    <a href={href} aria-current={on ? "page" : undefined} className={`flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium ${on ? "border-amber-400 text-white" : "border-transparent text-slate-300 hover:text-white"}`}><Icon size={16} aria-hidden="true" />{label}</a>;

  return <Frame>
    <header className="sticky top-0 z-20 bg-[#0b1f33] text-white shadow">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ShieldCheck size={26} className="shrink-0 text-amber-400" aria-hidden="true" />
          <div className="min-w-0 leading-tight"><p className="truncate text-sm font-semibold tracking-wide">COMMUNITY POLICING</p><p className="truncate text-[11px] uppercase tracking-wider text-slate-400">Police Operations</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block"><p className="text-sm">{profile.displayName}</p><p className="text-[11px] text-slate-400">{[profile.badgeNumber, profile.station, profile.district].filter(Boolean).join(" · ") || profile.role}</p></div>
          <button onClick={() => void signOut()} className="flex min-h-10 items-center gap-1.5 rounded border border-slate-600 px-2.5 text-xs text-slate-200 hover:bg-slate-800"><LogOut size={14} aria-hidden="true" />Sign out</button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2" aria-label="Police sections">
        {tab("/police", "Incidents", ListChecks, active === "incidents")}
        {tab("/police/dashboard", "Dashboard", LayoutDashboard, active === "dashboard")}
        {isAdmin && tab("/super-admin", "Administration", Settings, active === "admin")}
      </nav>
    </header>
    {children(profile)}
  </Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="min-h-screen text-slate-900">{children}</div>;
}
