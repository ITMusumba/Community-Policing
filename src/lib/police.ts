// Formal wording and response-time rules for police and admin screens (see apprules.md, "Professional standard").

export type Priority = "p1" | "p2" | "p3" | "p4";

/** Minutes allowed before the first police response. Keep in sync with PRIORITY_TARGET_MIN in convex/reports.ts. */
export const PRIORITY: Record<Priority, { short: string; label: string; targetMin: number; badge: string }> = {
  p1: { short: "P1", label: "P1 · Immediate (30 min)", targetMin: 30, badge: "bg-red-700 text-white" },
  p2: { short: "P2", label: "P2 · Urgent (2 h)", targetMin: 120, badge: "bg-amber-500 text-slate-950" },
  p3: { short: "P3", label: "P3 · Routine (24 h)", targetMin: 1440, badge: "bg-slate-600 text-white" },
  p4: { short: "P4", label: "P4 · Low (72 h)", targetMin: 4320, badge: "bg-slate-300 text-slate-900" },
};

export const CATEGORY_LABEL: Record<string, string> = {
  theft: "Theft", robbery: "Robbery", assault: "Assault", domestic_violence: "Domestic violence",
  sexual_violence: "Sexual offence", accident: "Road traffic accident", fire: "Fire", drugs: "Narcotics",
  suspicious_activity: "Suspicious activity", livestock_theft: "Livestock theft",
  land_property_dispute: "Land / property dispute", arson: "Arson", illegal_dumping: "Illegal dumping", terrorism: "Terrorism / explosive threat",
  crop_theft: "Crop theft", child_abuse: "Child abuse", other: "Other",
};

export const STATUS_LABEL = {
  received: "New", seen: "Acknowledged", assigned: "Assigned", en_route: "Dispatched",
  closed: "Closed", duplicate: "Duplicate", false: "Unfounded",
} as const;

export function elapsed(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}

/** Response timer shown on open incidents: on time, due soon (last 25%), or overdue. */
export function responseState(createdAt: number, firstResponseAt: number | undefined, priority: Priority, now: number) {
  const target = PRIORITY[priority].targetMin * 60_000;
  if (firstResponseAt) {
    const took = firstResponseAt - createdAt;
    return { overdue: false, text: `First response after ${elapsed(took)} (target ${elapsed(target)})`, tone: took > target ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900" };
  }
  const left = createdAt + target - now;
  if (left < 0) return { overdue: true, text: `Response overdue by ${elapsed(-left)}`, tone: "bg-red-50 text-red-800" };
  if (left < target * 0.25) return { overdue: false, text: `Response due in ${elapsed(left)}`, tone: "bg-amber-50 text-amber-900" };
  return { overdue: false, text: `Response due in ${elapsed(left)}`, tone: "bg-slate-100 text-slate-700" };
}
