"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

function ConfiguredAuthPanel() {
  const { signIn, signOut } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const profile = useQuery(api.profiles.me);
  const ensureCitizenProfile = useMutation(api.profiles.ensureCitizenProfile);
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (profile && !profileReady) setProfileReady(true);
  }, [profile, profileReady]);

  useEffect(() => {
    if (!isAuthenticated || profile !== null || profileReady) return;
    let cancelled = false;
    const provision = async () => {
      try {
        await ensureCitizenProfile({
          displayName: mode === "signUp" ? name.trim() : undefined,
        });
        if (!cancelled) setProfileReady(true);
      } catch {
        if (!cancelled) setNotice("Your sign-in is active. We could not finish setting up your profile yet; please retry shortly.");
      }
    };
    void provision();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, profile, profileReady, ensureCitizenProfile, mode, name]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signUp" && name.trim().length < 2) {
        throw new Error("Enter your name (at least 2 characters).");
      }
      if (password.length < 8) {
        throw new Error("Use a password with at least 8 characters.");
      }
      await signIn("password", {
        email: email.trim().toLowerCase(),
        password,
        ...(mode === "signUp" ? { name: name.trim() } : {}),
        flow: mode,
      });
      setNotice(mode === "signUp" ? "Account created. Finishing your citizen profile…" : "Signed in successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return <section className="rounded-2xl border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">Checking your sign-in status…</section>;
  }

  if (profile && profile.isActive) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#176b87]">Signed in</p>
            <h2 className="mt-1 text-xl font-bold">{profile.displayName}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Account type: {profile.role}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{profile.role}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Your account is connected. Incident submission and case follow-up will be enabled
          as the remaining workflows are completed and tested.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 min-h-11 rounded-xl border border-[var(--line)] px-4 text-sm font-bold hover:bg-slate-50"
        >
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Citizen account</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Sign in or create an account to get started.</p>
        </div>
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Secure access</span>
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => { setMode("signIn"); setError(""); }} className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "signIn" ? "bg-white text-[#102a43] shadow-sm" : "text-slate-600"}`}>
          Sign in
        </button>
        <button type="button" onClick={() => { setMode("signUp"); setError(""); }} className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "signUp" ? "bg-white text-[#102a43] shadow-sm" : "text-slate-600"}`}>
          Create account
        </button>
      </div>

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
          {busy ? "Please wait…" : mode === "signUp" ? "Create citizen account" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
        Registration creates a citizen account only. Officer and administrator access must be granted separately by an authorized administrator.
      </p>
    </section>
  );
}

export default function AuthPanel({ enabled }: { enabled: boolean }) {
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
  return <ConfiguredAuthPanel />;
}
