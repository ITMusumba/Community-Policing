import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ClipboardList,
  MapPin,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import AuthPanel from "@/components/AuthPanel";

const actions = [
  {
    title: "Report an incident",
    description: "Share a safety concern with the appropriate team.",
    icon: AlertTriangle,
    href: "#report",
    tone: "amber",
  },
  {
    title: "My reports",
    description: "Follow updates on reports you have submitted.",
    icon: ClipboardList,
    href: "#reports",
    tone: "blue",
  },
  {
    title: "Community notices",
    description: "Read verified public safety updates.",
    icon: Bell,
    href: "#notices",
    tone: "teal",
  },
  {
    title: "Contact support",
    description: "Find help with using Community Policing.",
    icon: MessageCircle,
    href: "#support",
    tone: "purple",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="bg-[#102a43] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck aria-hidden="true" size={25} />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">Community Policing</p>
              <p className="text-xs text-slate-300">Safer communities, shared responsibility</p>
            </div>
          </div>
          <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-slate-100">
            Preview
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-28 pt-8 sm:px-8 sm:pt-12">
        <div className="rounded-3xl bg-gradient-to-br from-[#176b87] to-[#102a43] p-6 text-white shadow-sm sm:p-9">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <MapPin size={16} aria-hidden="true" />
            Community safety starts here
          </div>
          <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Your community. Your voice. A safer Uganda.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-100 sm:text-base">
            Report concerns, follow the progress of your reports, and stay informed
            through community safety notices.
          </p>
          <a
            href="#account"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#102a43] transition hover:bg-slate-100"
          >
            Sign in or register <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>

        <section id="account" className="mt-6">
          <AuthPanel enabled={Boolean(process.env.NEXT_PUBLIC_CONVEX_URL)} />
        </section>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">What would you like to do?</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Choose a service to get started.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {actions.map(({ title, description, icon: Icon, href, tone }) => (
            <a
              key={title}
              href={href}
              className="group flex min-h-32 items-start gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#176b87]">
                <Icon size={23} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#176b87]">
                  Open section <ArrowRight size={14} aria-hidden="true" />
                </span>
              </div>
              <span className="sr-only">{tone}</span>
            </a>
          ))}
        </div>

        <section id="report" className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 sm:p-6">
          <h2 className="font-bold">Incident submission is the next workflow</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Sign-in and citizen profile creation are being wired first. Report submission,
            complaint follow-up and messaging will be connected after the backend is deployed
            and access rules have been tested.
          </p>
        </section>

        <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">
          For emergencies, contact the appropriate local emergency service directly.
          Do not rely on this preview for urgent assistance.
        </p>
      </section>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 border-t border-[var(--line)] bg-white/95 px-5 pt-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md justify-around">
          <a href="#" className="flex flex-col items-center gap-1 px-3 py-1 text-xs font-semibold text-[#176b87]">
            <ShieldCheck size={20} aria-hidden="true" /> Home
          </a>
          <a href="#report" className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-[var(--muted)]">
            <AlertTriangle size={20} aria-hidden="true" /> Report
          </a>
          <a href="#notices" className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-[var(--muted)]">
            <Bell size={20} aria-hidden="true" /> Notices
          </a>
          <a href="#support" className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-[var(--muted)]">
            <MessageCircle size={20} aria-hidden="true" /> Help
          </a>
        </div>
      </nav>
    </main>
  );
}
