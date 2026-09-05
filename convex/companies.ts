import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
    industry: v.optional(v.string()),
    hqJurisdiction: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("companies", {
      ...args,
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
