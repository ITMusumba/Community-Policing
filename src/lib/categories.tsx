"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BUILTIN_CATEGORIES, type CategoryDef } from "@/convex/lib/categories";

export { BUILTIN_CATEGORIES, type CategoryDef };

const CACHE_KEY = "cp-categories-v1";
const BUILTIN_EMOJI = new Map(BUILTIN_CATEGORIES.map(c => [c.key, c.emoji]));

function readCache(): CategoryDef[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const ok = parsed.every(c => c && typeof c === "object" && typeof c.key === "string" && typeof c.label === "string" && typeof c.emoji === "string");
    return ok ? parsed as CategoryDef[] : null;
  } catch { return null; }
}

/**
 * Category list for every screen. Starts with the built-in list so the report screen works at once and offline,
 * then uses the server list (built-in + admin changes). The last server list is kept on the phone so
 * admin-added categories still show when the app is reopened without a connection.
 */
export function useCategories() {
  const live: CategoryDef[] | undefined = useQuery(api.categories.list, {});
  const [cached, setCached] = useState<CategoryDef[] | null>(null);
  useEffect(() => { setCached(readCache()); }, []);
  useEffect(() => {
    if (!live) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(live)); } catch { /* storage unavailable */ }
  }, [live]);
  const all = live ?? cached ?? BUILTIN_CATEGORIES;
  return useMemo(() => {
    // byKey includes hidden categories so older reports still get their names.
    const byKey = new Map(all.map(c => [c.key, c]));
    const shown = all.filter(c => c.active);
    return {
      all,
      main: shown.filter(c => c.main),
      more: shown.filter(c => !c.main),
      byKey,
      label: (key: string) => byKey.get(key)?.label ?? key.replace(/_/g, " "),
      formal: (key: string) => { const c = byKey.get(key); return c?.formal ?? c?.label ?? key.replace(/_/g, " "); },
    };
  }, [all]);
}

// Small drawings for crimes with no clear emoji on older phones.
function CoffeeBeans({ className }: { className: string }) {
  return <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <g transform="rotate(-28 22 34)"><ellipse cx="22" cy="34" rx="13" ry="18" fill="#7b4a2a" /><path d="M22 17c-6 8 6 18 0 34" stroke="#3e2314" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
    <g transform="rotate(24 43 30)"><ellipse cx="43" cy="30" rx="13" ry="18" fill="#9a5d36" /><path d="M43 13c-6 8 6 18 0 34" stroke="#4a2a17" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
  </svg>;
}
/** A house standing in water among reeds: building in a wetland. */
function WetlandHouse({ className }: { className: string }) {
  return <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path d="M6 44c3-14 4-24 4-32M12 46c1-12 3-20 7-28M58 44c-3-14-4-24-4-32M52 46c-1-12-3-20-7-28" stroke="#4d8b31" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M18 30 32 18l14 12v14H18z" fill="#f4e1c1" stroke="#8a5a2b" strokeWidth="2" strokeLinejoin="round" />
    <path d="M15 31 32 16l17 15" stroke="#c0392b" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="28" y="34" width="8" height="10" fill="#8a5a2b" />
    <path d="M2 48q5-4 10 0t10 0 10 0 10 0 10 0 10 0v14H2z" fill="#3b8fd1" />
    <path d="M6 55q4-3 8 0t8 0M36 56q4-3 8 0t8 0" stroke="#bfe1fb" strokeWidth="2" fill="none" strokeLinecap="round" />
  </svg>;
}
/** A cut tree stump with an axe: illegal tree cutting. */
function TreeStumpAxe({ className }: { className: string }) {
  return <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path d="M14 58V36h22v22z" fill="#8a5a2b" />
    <ellipse cx="25" cy="36" rx="11" ry="4" fill="#e9c58f" stroke="#8a5a2b" strokeWidth="2" />
    <path d="M25 36m-6 0a6 2 0 1 0 12 0a6 2 0 1 0-12 0" fill="none" stroke="#b9874f" strokeWidth="1.5" />
    <path d="M8 58h50" stroke="#4d8b31" strokeWidth="4" strokeLinecap="round" />
    <path d="M37 39 56 10" stroke="#7b4a2a" strokeWidth="4" strokeLinecap="round" />
    <path d="M47 13c6-8 14-6 14 2-5-1-8 2-9 7z" fill="#9aa5b1" stroke="#4b5563" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>;
}
const DRAWN: Record<string, (p: { className: string }) => ReactElement> = { crop_theft: CoffeeBeans, wetland_encroachment: WetlandHouse, illegal_logging: TreeStumpAxe };

function pictureCount(emoji: string) {
  try { return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(emoji)].length; }
  catch { return [...emoji].length > 2 ? 2 : 1; }
}

/** Tile picture: the drawing for built-in categories that have one (unless an admin changed the emoji), else the emoji. */
export function CategoryIcon({ cat, size }: { cat: Pick<CategoryDef, "key" | "emoji"> | undefined; size: "lg" | "sm" }) {
  if (!cat) return <span aria-hidden="true">❔</span>;
  const Drawing = DRAWN[cat.key];
  if (Drawing && BUILTIN_EMOJI.get(cat.key) === cat.emoji) return <Drawing className={size === "lg" ? "h-12 w-12" : "inline h-5 w-5 align-text-bottom"} />;
  // Two-picture tiles (e.g. house + fire) are a size smaller so they stay on one line.
  const large = pictureCount(cat.emoji) > 1 ? "whitespace-nowrap text-4xl" : "text-5xl";
  return <span className={size === "lg" ? large : "whitespace-nowrap"} aria-hidden="true">{cat.emoji}</span>;
}
