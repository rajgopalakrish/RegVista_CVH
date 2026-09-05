import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  companies: defineTable({
    name: v.string(),
    industry: v.optional(v.string()),
    hqJurisdiction: v.optional(v.string()),
    website: v.optional(v.string()),
    createdAt: v.number(),
  }),

  researchRuns: defineTable({
    companyId: v.id("companies"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("done"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_companyId", ["companyId"]),

  findings: defineTable({
    companyId: v.id("companies"),
    researchRunId: v.id("researchRuns"),
    jurisdiction: v.string(),
    regulator: v.string(),
    regulatoryArea: v.string(),
    title: v.string(),
    summary: v.string(),
    relevanceScore: v.number(),
    whyItMatters: v.string(),
    sources: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        retrievedAt: v.number(),
      }),
    ),
    createdAt: v.number(),
  }).index("by_companyId", ["companyId"]),
});
