import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { BUILTIN_CATEGORIES, mergeCategories, type CategoryDef } from "./lib/categories";

const group = v.union(v.literal("environment"), v.literal("general"));
const priority = v.union(v.literal("p1"), v.literal("p2"), v.literal("p3"), v.literal("p4"));

export async function allCategories(ctx: QueryCtx): Promise<CategoryDef[]> {
  const stored = await ctx.db.query("crimeCategories").collect();
  return mergeCategories(stored);
}

/** Public: the citizen report screen and police screens read the category list from here. */
export const list = query({
  args: {},
  handler: async (ctx) => await allCategories(ctx),
});

function clean(label: string, emoji: string) {
  const l = label.trim().replace(/\s+/g, " ");
  const e = emoji.trim().replace(/\s+/g, "");
  if (l.length < 2 || l.length > 40) throw new ConvexError("The name must be 2 to 40 characters.");
  // An emoji is not a letter or a digit; at most three pictures so the tile stays readable.
  if (!e || e.length > 24 || /[\p{L}\p{N}]/u.test(e.replace(/️|⃣/g, ""))) throw new ConvexError("Choose an emoji picture (no letters or numbers).");
  return { label: l, emoji: e };
}

/** Add a new category, or change a built-in or added one (pass its key). Admins and super-admins. */
export const save = mutation({
  args: {
    key: v.optional(v.string()), label: v.string(), emoji: v.string(), group, priority,
    main: v.boolean(), active: v.boolean(), order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const { label, emoji } = clean(args.label, args.emoji);
    const now = Date.now();
    const all = await allCategories(ctx);
    if (all.some(c => c.key !== args.key && c.label.toLowerCase() === label.toLowerCase())) throw new ConvexError("A category with this name already exists.");
    let key = args.key;
    if (key) {
      const current = all.find(c => c.key === key);
      if (!current) throw new ConvexError("Category not found.");
      if (key === "other" && !args.active) throw new ConvexError("\"Other\" cannot be hidden; reports without a type are filed under it.");
      const order = args.order ?? current.order;
      const row = await ctx.db.query("crimeCategories").withIndex("by_key", q => q.eq("key", key!)).unique();
      const fields = { label, emoji, group: args.group, priority: args.priority, main: args.main, active: args.active, order, updatedAt: now };
      if (row) await ctx.db.patch(row._id, fields);
      else await ctx.db.insert("crimeCategories", { key, ...fields, createdAt: now, createdBy: actor._id });
    } else {
      const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "category";
      key = base;
      for (let n = 2; all.some(c => c.key === key); n++) key = `${base}_${n}`;
      const order = args.order ?? Math.max(0, ...all.filter(c => c.main === args.main).map(c => c.order)) + 10;
      await ctx.db.insert("crimeCategories", { key, label, emoji, group: args.group, priority: args.priority, main: args.main, active: args.active, order, createdAt: now, updatedAt: now, createdBy: actor._id });
    }
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: args.key ? "category.update" : "category.create", entityType: "crimeCategory", entityId: key, details: `${emoji} ${label}${args.active ? "" : " (hidden)"}`, createdAt: now });
    return { key };
  },
});

/** Put a built-in category back to its original picture, name and position. */
export const resetBuiltin = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (!BUILTIN_CATEGORIES.some(c => c.key === args.key)) throw new ConvexError("Only built-in categories can be reset.");
    const row = await ctx.db.query("crimeCategories").withIndex("by_key", q => q.eq("key", args.key)).unique();
    if (row) await ctx.db.delete(row._id);
    await ctx.db.insert("auditLogs", { actorId: actor._id, action: "category.reset", entityType: "crimeCategory", entityId: args.key, createdAt: Date.now() });
    return { success: true };
  },
});
