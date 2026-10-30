"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Set NEXT_PUBLIC_APK_URL once the Android build is hosted; the button then downloads it on Android.
const APK_URL = process.env.NEXT_PUBLIC_APK_URL;

/**
 * Small "Get the app" pill on every page. Uses the browser install prompt where available,
 * otherwise shows Add-to-Home-screen steps. Hidden only inside the installed app; "Not now" just closes the steps.
 */
export default function InstallApp() {
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const installed = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
      || "Capacitor" in window;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setVisible(!installed);
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (!visible) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "accepted") setVisible(false);
      setPrompt(null);
      return;
    }
    if (APK_URL && !ios) { window.location.href = APK_URL; return; }
    setHelp(h => !h);
  }

  return <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 print:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
    {help && <div role="dialog" aria-label="Install COMPOLI" className="w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
      <p className="font-semibold text-[#102a43]">Add COMPOLI to your home screen</p>
      {ios
        ? <p className="mt-1">In Safari, tap the Share button <span aria-hidden="true">⬆️</span>, then <strong>Add to Home Screen</strong>.</p>
        : <p className="mt-1">Open the browser menu <span aria-hidden="true">⋮</span>, then tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>}
      <button onClick={() => setHelp(false)} className="mt-2 text-slate-500 underline">Not now</button>
    </div>}
    <button onClick={() => void install()} aria-label="Download the COMPOLI app"
      className="flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white/90 px-3 text-xs font-semibold text-[#102a43] shadow-sm backdrop-blur hover:bg-white">
      <span aria-hidden="true">📲</span>Get app
    </button>
  </div>;
}
