import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const start = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const runId = await ctx.db.insert("researchRuns", {
      companyId,
      status: "pending",
      startedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.researchActions.run, {
      runId,
      companyId,
    });
    return runId;
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const runs = await ctx.db
      .query("researchRuns")
      .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
      .order("desc")
      .collect();

    const findings = await ctx.db
      .query("findings")
      .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
      .order("desc")
      .collect();

    return { latestRun: runs[0] ?? null, runs, findings };
  },
});

export const recordFindings = internalMutation({
  args: {
    companyId: v.id("companies"),
    researchRunId: v.id("researchRuns"),
    findings: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, { companyId, researchRunId, findings }) => {
    for (const finding of findings) {
      await ctx.db.insert("findings", {
        companyId,
        researchRunId,
        createdAt: Date.now(),
        ...finding,
      });
    }
  },
});

export const updateRunStatus = internalMutation({
  args: {
    runId: v.id("researchRuns"),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { runId, status, error }) => {
    await ctx.db.patch(runId, {
      status,
      error,
      ...(status === "done" || status === "error"
        ? { finishedAt: Date.now() }
        : {}),
    });
  },
});
