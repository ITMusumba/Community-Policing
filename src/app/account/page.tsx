import AuthPanel from "@/components/AuthPanel";

export default function AccountPage() {
  return <main className="mx-auto min-h-screen max-w-xl bg-slate-50 p-5 text-[#102a43]">
    <a href="/" className="text-sm font-bold underline">← Home</a>
    <h1 className="mb-4 mt-4 text-2xl font-black">Sign in or create an account</h1>
    <p className="mb-4 text-sm text-slate-600">You do not need an account to report a crime. Accounts are for police staff and administrators. Creating one makes a citizen account; an administrator must enable police access.</p>
    <AuthPanel enabled />
    <nav className="mt-6 flex gap-4 text-sm font-bold underline"><a href="/police">Police feed</a><a href="/super-admin">Super-admin</a></nav>
  </main>;
}
