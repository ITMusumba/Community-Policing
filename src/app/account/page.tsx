const PORTALS = [
  { href: "/citizen/login", title: "Citizen", text: "Follow your reports and read police replies. No account is needed to report a crime." },
  { href: "/police/login", title: "Officer", text: "Incident feed and dashboard. Accounts are issued by your administrator." },
  { href: "/admin/login", title: "Administrator", text: "Personnel, police accounts and stations." },
];

export default function AccountPage() {
  return <main className="mx-auto min-h-screen max-w-xl p-5 text-[#102a43]">
    <a href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm hover:bg-slate-50">🏠 Home</a>
    <h1 className="mb-4 mt-4 text-2xl font-black">Sign in</h1>
    <ul className="space-y-3">{PORTALS.map(p => <li key={p.href}>
      <a href={p.href} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[#176b87]">
        <span className="text-lg font-bold">{p.title} →</span>
        <span className="mt-1 block text-sm text-slate-600">{p.text}</span>
      </a>
    </li>)}</ul>
  </main>;
}
