"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

export type Audience = "citizen" | "police" | "admin";

const AUDIENCE = {
  citizen: {
    title: "Citizen account",
    intro: "Sign in or create an account to follow your reports and receive police replies.",
    roles: ["citizen"],
    home: "/citizen",
    footer: "You stay anonymous to police unless you choose to share your name and phone on a report.",
    wrongRole: "This is a police or administrator account. Use the staff sign-in page.",
  },
  police: {
    title: "Police sign in",
    intro: "Sign in with the account issued to you by your administrator.",
    roles: ["officer", "admin", "super_admin"],
    home: "/police",
    footer: "Police accounts are created by an administrator. If you have not received one, contact your station commander.",
    wrongRole: "This account is not authorised for police operations.",
  },
  admin: {
    title: "Administrator sign in",
    intro: "For commanders and system administrators. All access is logged.",
    roles: ["admin", "super_admin"],
    home: "/super-admin",
    footer: "Administrator access is granted by a super-admin only.",
    wrongRole: "This account does not have administrator access.",
  },
} as const;

/** Only same-site paths are accepted as a post-sign-in destination. */
function nextPath(fallback: string) {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function ConfiguredAuthPanel({ audience }: { audience: Audience }) {
  const config = AUDIENCE[audience];
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.me, isAuthenticated ? {} : "skip");
  const ensureCitizenProfile = useMutation(api.profiles.ensureCitizenProfile);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const allowed = !!profile && profile.isActive && (config.roles as readonly string[]).includes(profile.role);

  // Only the citizen page creates a profile for a brand-new sign-in. Staff profiles are created by administrators.
  useEffect(() => {
    if (audience !== "citizen" || !isAuthenticated || profile !== null) return;
    ensureCitizenProfile({ displayName: mode === "signUp" ? name.trim() : undefined })
      .catch(() => setNotice("Your sign-in is active. We could not finish setting up your profile yet; please retry shortly."));
  }, [audience, isAuthenticated, profile, ensureCitizenProfile, mode, name]);

  useEffect(() => {
    if (allowed) window.location.replace(nextPath(config.home));
  }, [allowed, config.home]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signUp" && name.trim().length < 2) throw new Error("Enter your name (at least 2 characters).");
      if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        ...(mode === "signUp" ? { name: name.trim() } : {}),
        flow: mode,
      });
      setNotice(mode === "signUp" ? "Account created. Opening your dashboard…" : "Signed in. Opening your dashboard…");
    } catch {
      setError(mode === "signUp" ? "Could not create the account. The email may already be registered." : "Email or password is incorrect.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || (isAuthenticated && profile === undefined)) {
    return <section className="rounded-2xl border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">Checking your sign-in status…</section>;
  }

  if (isAuthenticated && allowed) {
    return <section className="rounded-2xl border border-[var(--line)] bg-white p-6 text-sm">Signed in as <strong>{profile.displayName}</strong>. Opening your dashboard… <a className="underline" href={nextPath(config.home)}>Continue</a></section>;
  }

  if (isAuthenticated && profile !== null) {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold">Signed in as {profile?.displayName}</h2>
        <p className="mt-2 text-sm text-red-800">{profile?.isActive === false ? "This account has been disabled." : config.wrongRole}</p>
        <button type="button" onClick={() => void signOut()} className="mt-4 min-h-11 rounded-xl border border-[var(--line)] px-4 text-sm font-bold hover:bg-slate-50">Sign out</button>
      </section>
    );
  }

  if (isAuthenticated && audience !== "citizen") {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-red-800">{config.wrongRole}</p>
        <button type="button" onClick={() => void signOut()} className="mt-4 min-h-11 rounded-xl border border-[var(--line)] px-4 text-sm font-bold hover:bg-slate-50">Sign out</button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold">{config.title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{config.intro}</p>

      {audience === "citizen" && <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => { setMode("signIn"); setError(""); }} className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "signIn" ? "bg-white text-[#102a43] shadow-sm" : "text-slate-600"}`}>
          Sign in
        </button>
        <button type="button" onClick={() => { setMode("signUp"); setError(""); }} className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "signUp" ? "bg-white text-[#102a43] shadow-sm" : "text-slate-600"}`}>
          Create account
        </button>
      </div>}

      <form onSubmit={submit} className="mt-5 space-y-4">
        {mode === "signUp" && (
          <label className="block text-sm font-semibold">
            Full name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={120} className="mt-1.5 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal outline-none focus:border-[#176b87] focus:ring-2 focus:ring-cyan-100" placeholder="Enter your name" />
          </label>
        )}
        <label className="block text-sm font-semibold">
          Email address
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="mt-1.5 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal outline-none focus:border-[#176b87] focus:ring-2 focus:ring-cyan-100" placeholder="you@example.com" />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signUp" ? "new-password" : "current-password"} minLength={8} required className="mt-1.5 min-h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-normal outline-none focus:border-[#176b87] focus:ring-2 focus:ring-cyan-100" placeholder="At least 8 characters" />
        </label>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-cyan-50 p-3 text-sm text-cyan-900">{notice}</p>}

        <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-[#102a43] px-4 text-sm font-bold text-white transition hover:bg-[#176b87] disabled:cursor-wait disabled:opacity-60">
          {busy ? "Please wait…" : mode === "signUp" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{config.footer}</p>
    </section>
  );
}

export default function AuthPanel({ enabled = true, audience }: { enabled?: boolean; audience: Audience }) {
  if (!enabled) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
        <h2 className="font-bold text-amber-950">Authentication setup required</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Connect a Convex deployment and set NEXT_PUBLIC_CONVEX_URL before sign-in and registration can be used. No account data is being stored by this preview.
        </p>
      </section>
    );
  }
  return <ConfiguredAuthPanel audience={audience} />;
}
