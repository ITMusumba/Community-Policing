import AuthPanel, { type Audience } from "@/components/AuthPanel";

const OTHERS: { audience: Audience; href: string; label: string }[] = [
  { audience: "citizen", href: "/citizen/login", label: "Citizen account" },
  { audience: "police", href: "/police/login", label: "Police sign in" },
  { audience: "admin", href: "/admin/login", label: "Administrator sign in" },
];

/** Shared frame for the three separate sign-in pages: back link, heading, panel, links to the other portals. */
export default function LoginPage({ audience, heading, intro }: { audience: Audience; heading: string; intro: string }) {
  return <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-5 text-[#102a43]">
    <a href="/" className="text-sm font-bold underline">← Home</a>
    <h1 className="mb-2 mt-4 text-2xl font-black">{heading}</h1>
    <p className="mb-4 text-sm text-slate-600">{intro}</p>
    <AuthPanel audience={audience} />
    <nav aria-label="Other sign-in pages" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
      {OTHERS.filter(o => o.audience !== audience).map(o => <a key={o.href} href={o.href} className="font-semibold underline">{o.label}</a>)}
    </nav>
  </main>;
}
