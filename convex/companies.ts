import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Case/whitespace-insensitive identity key for "is this the same company
// name" — trims, lowercases, and collapses internal whitespace runs, so
// "Google", " google ", and "Google  Inc" (mid-string double space) all
// normalize the same way a human would read them as equivalent. This is
// name-only, not name+jurisdiction: a company already gets researched
// under different jurisdictions across separate runs on the SAME record
// (that's the existing multi-run feature), so keying company identity to
// jurisdiction would fragment one real company back into several records
// exactly the way this fix is meant to prevent.
function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export const create = mutation({
  args: {
    name: v.string(),
    industry: v.optional(v.string()),
    hqJurisdiction: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeCompanyName(args.name);
    // Table is small (a handful of demo companies) — a full scan compared
    // in JS avoids adding a stored normalized-name field/index just for
    // this, and needs no migration for existing rows. When more than one
    // existing row matches (pre-existing duplicates from before this fix),
    // reuse the NEWEST one — the same "most recent wins" rule
    // recentCompanies already uses to decide which row is canonical — so
    // this never resurrects an old shadow record as if it were current.
    const matches = (await ctx.db.query("companies").collect()).filter(
      (c) => normalizeCompanyName(c.name) === normalized,
    );
    if (matches.length > 0) {
      const newest = matches.reduce((a, b) => (b._creationTime > a._creationTime ? b : a));
      return newest._id;
    }

    return await ctx.db.insert("companies", {
      ...args,
      name: args.name.trim(),
      createdAt: Date.now(),
    });
  },
});

export const get = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db.get(companyId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").order("desc").take(20);
  },
});
