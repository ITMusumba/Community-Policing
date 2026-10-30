import AuthPanel, { type Audience } from "@/components/AuthPanel";

const OTHERS: { audience: Audience; href: string; label: string }[] = [
  { audience: "citizen", href: "/citizen/login", label: "Citizen Account" },
  { audience: "police", href: "/police/login", label: "Officer Sign In" },
  { audience: "admin", href: "/admin/login", label: "Admin Sign In" },
];

/** Shared frame for the three separate sign-in pages: back link, heading, panel, links to the other portals. */
export default function LoginPage({ audience, heading, intro }: { audience: Audience; heading: string; intro: string }) {
  return <main className="mx-auto min-h-screen max-w-xl p-5 text-[#102a43]">
    <a href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm hover:bg-slate-50">🏠 Home</a>
    <h1 className="mb-2 mt-4 text-2xl font-black">{heading}</h1>
    <p className="mb-4 text-sm text-slate-600">{intro}</p>
    <AuthPanel audience={audience} />
    <nav aria-label="Other sign-in pages" className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm">
      {OTHERS.filter(o => o.audience !== audience).map(o => <a key={o.href} href={o.href} className="font-semibold underline">{o.label}</a>)}
    </nav>
  </main>;
}
