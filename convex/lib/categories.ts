// Built-in incident categories, shared by the server and the app (the app bundles them so reporting works offline).
// Admins can add categories and change or hide these from Administration > Categories; those changes are stored
// in the `crimeCategories` table and layered on top of this list.

export type CategoryGroup = "environment" | "general";
export type CategoryPriority = "p1" | "p2" | "p3" | "p4";
export type CategoryDef = {
  key: string;
  /** Short label under the picture on the citizen screen. */
  label: string;
  /** Formal wording on police screens. Falls back to `label`. */
  formal?: string;
  /** Emoji shown on the tile. Keep to emoji that old Android phones have (Android 10 or older). */
  emoji: string;
  group: CategoryGroup;
  priority: CategoryPriority;
  /** Shown straight away on "What happened?"; the rest sit behind "See more". */
  main: boolean;
  active: boolean;
  order: number;
  builtin: boolean;
};

const def = (order: number, key: string, emoji: string, label: string, formal: string | undefined, group: CategoryGroup, priority: CategoryPriority, main: boolean): CategoryDef =>
  ({ key, emoji, label, formal, group, priority, main, active: true, order, builtin: true });

// Emoji are limited to Emoji 11 or older so they show on Android 9 phones. Where no clear emoji exists, the app
// draws a small picture instead (see src/lib/categories.tsx); the emoji here is then only a fallback.
export const BUILTIN_CATEGORIES: CategoryDef[] = [
  // Environmental crimes come first for now (National Environment Act 2019 offences that NEMA and the Environmental Police act on).
  def(10, "illegal_dumping", "🗑️", "Dumping", "Illegal dumping", "environment", "p3", true),
  def(20, "wetland_encroachment", "🏠💧", "Wetland", "Wetland encroachment / filling", "environment", "p2", true),
  def(30, "illegal_logging", "🌳✂️", "Tree cutting", "Illegal logging / tree cutting", "environment", "p2", true),
  def(40, "bush_burning", "🌳🔥", "Bush burning", "Bush burning / illegal charcoal", "environment", "p2", true),
  def(50, "water_pollution", "💧☠️", "Water pollution", "Water pollution", "environment", "p2", true),
  def(60, "air_pollution", "🏭", "Air pollution", "Air pollution", "environment", "p3", true),
  def(70, "sand_mining", "⛏️", "Sand mining", "Illegal sand mining / quarrying", "environment", "p3", true),
  def(80, "wildlife_poaching", "🐘🏹", "Poaching", "Wildlife poaching / trafficking", "environment", "p2", true),
  // Urgent crimes stay on the main grid so nobody has to search for them.
  def(90, "robbery", "🔪", "Robbery", "Robbery", "general", "p1", true),
  def(100, "assault", "🤕", "Assault", "Assault", "general", "p1", true),
  def(110, "child_abuse", "🚸", "Child abuse", "Child abuse", "general", "p1", true),
  def(120, "other", "❔", "Other", "Other", "general", "p4", true),
  // Behind "See more": the remaining environmental crimes first, then other crimes.
  def(200, "illegal_fishing", "🐟", "Illegal fishing", "Illegal fishing", "environment", "p3", false),
  def(210, "noise_pollution", "📢", "Noise", "Noise pollution", "environment", "p4", false),
  def(220, "plastic_bags", "🛍️", "Plastic bags", "Banned plastic bags (kaveera)", "environment", "p4", false),
  def(300, "theft", "💰", "Theft", "Theft", "general", "p2", false),
  def(310, "domestic_violence", "🏠", "Home violence", "Domestic violence", "general", "p2", false),
  def(320, "sexual_violence", "🛑", "Sexual assault", "Sexual offence", "general", "p1", false),
  def(330, "accident", "🚗", "Traffic accident", "Road traffic accident", "general", "p1", false),
  // "☕" is drawn as coffee beans in the app (there is no coffee-bean emoji).
  def(340, "crop_theft", "☕", "Crop theft", "Crop theft", "general", "p1", false),
  def(350, "livestock_theft", "🐄", "Animal theft", "Livestock theft", "general", "p1", false),
  def(360, "drugs", "💊", "Drugs", "Narcotics", "general", "p2", false),
  def(370, "suspicious_activity", "👁️", "Suspicious", "Suspicious activity", "general", "p3", false),
  def(380, "land_property_dispute", "🏡", "Land", "Land / property dispute", "general", "p4", false),
  def(390, "fire", "🔥", "Fire", "Fire", "general", "p1", false),
  def(400, "arson", "🏠🔥", "Arson", "Arson", "general", "p1", false),
  def(410, "terrorism", "💣", "Terrorism", "Terrorism / explosive threat", "general", "p1", false),
];

/** What an admin stored for a category: a whole new one, or changes to a built-in one with the same key. */
export type StoredCategory = { key: string; label: string; emoji: string; group: CategoryGroup; priority: CategoryPriority; main: boolean; active: boolean; order: number };

/** Built-in list with the admin's changes and additions applied, in display order. */
export function mergeCategories(stored: StoredCategory[]): CategoryDef[] {
  const byKey = new Map(stored.map(s => [s.key, s]));
  const merged: CategoryDef[] = BUILTIN_CATEGORIES.map(b => {
    const s = byKey.get(b.key);
    if (!s) return b;
    byKey.delete(b.key);
    // A renamed built-in uses the admin's wording on police screens too.
    return { ...b, label: s.label, formal: s.label === b.label ? b.formal : s.label, emoji: s.emoji, group: s.group, priority: s.priority, main: s.main, active: s.active, order: s.order };
  });
  for (const s of byKey.values()) merged.push({ key: s.key, label: s.label, emoji: s.emoji, group: s.group, priority: s.priority, main: s.main, active: s.active, order: s.order, builtin: false });
  return merged.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}
