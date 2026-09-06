import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  applicabilityEvidenceValidator,
  applicabilityLevelValidator,
  itemTypeValidator,
  jurisdictionValidator,
  regulatoryStatusValidator,
  sourceQualityValidator,
} from "./schema";

// --- Regime ledger: credibility bar + identity normalization ---------------
//
// Only findings that clear this bar ever create/confirm a ledger entry: a
// specific named regime, decently relevant, not from a merely-secondary
// source, and not already flagged as possible/uncertain. This reuses fields
// the classifier already produces — no new ontology or prompt changes.
const LEDGER_MIN_RELEVANCE = 50;

function isLedgerEligible(finding: {
  itemType: string;
  regimeKey?: string;
  relevanceScore: number;
  sourceQuality: string;
  applicabilityEvidence: string;
}): boolean {
  return (
    finding.itemType === "REGULATION_REGIME" &&
    !!finding.regimeKey &&
    finding.relevanceScore >= LEDGER_MIN_RELEVANCE &&
    finding.sourceQuality !== "TIER_3_SECONDARY_REPORTING" &&
    finding.applicabilityEvidence !== "POSSIBLE_UNCERTAIN"
  );
}

const ACRONYM_STOPWORDS = new Set(["of", "the", "and", "for", "in", "on", "to", "a", "an"]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Normalizes a free-text regimeKey into a stable dedup key, so the same
// regime lands on the same ledger row whether a run names it by its full
// title or its short acronym (both forms show up across runs for the same
// regime — e.g. "Singapore Personal Data Protection Act" vs "PDPA"):
//  1. A parenthesized acronym at the end ("...Act 2012 (PDPA)") wins.
//  2. A bare acronym given directly as the whole regimeKey ("PDPA") is used
//     as-is.
//  3. Otherwise, initials of the significant words ("Personal Data
//     Protection Act" -> "pdpa") are used, so it lines up with (1) and (2)
//     for the same regime — but only when 4+ characters long, to avoid
//     collapsing two differently-named short acts (e.g. "Banking Act" /
//     "Broadcasting Act") onto the same 2-3 letter initials.
//  4. Falls back to lowercased, year-stripped free text of the name with
//     any parenthetical dropped — a trailing "(Cap 50B)"-style chapter/
//     citation qualifier shouldn't split "Competition Act 2004" and
//     "Competition Act (Cap 50B)" into two ledger rows for the same Act.
// General text normalization throughout — not a curated regulation lookup.
function canonicalRegimeIdentity(regimeKey: string, jurisdiction?: string): string {
  let name = regimeKey.trim();
  if (jurisdiction) {
    name = name.replace(new RegExp(`^${escapeRegExp(jurisdiction)}\\s+`, "i"), "");
  }

  const acronymMatch = name.match(/\(([A-Za-z0-9&-]{2,10})\)\s*$/);
  if (acronymMatch) {
    return acronymMatch[1].toLowerCase();
  }

  const withoutParens = name.replace(/\([^)]*\)/g, " ").trim();

  if (/^[A-Za-z][A-Za-z0-9&-]{1,9}$/.test(withoutParens)) {
    return withoutParens.toLowerCase();
  }

  const initials = withoutParens
    .split(/[^A-Za-z0-9]+/)
    // Drop pure-number tokens (a trailing year like "2022") — they're never
    // part of a regime's actual acronym, just a date some runs append and
    // others don't.
    .filter((w) => w.length > 0 && !ACRONYM_STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w))
    .map((w) => w[0])
    .join("")
    .toLowerCase();
  if (initials.length >= 4) return initials;

  return withoutParens
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const start = mutation({
  args: {
    companyId: v.id("companies"),
    // Omit for Global / Auto-detect.
    jurisdiction: v.optional(jurisdictionValidator),
  },
  handler: async (ctx, { companyId, jurisdiction }) => {
    const runId = await ctx.db.insert("researchRuns", {
      companyId,
      status: "pending",
      startedAt: Date.now(),
      requestedJurisdiction: jurisdiction,
    });
    await ctx.scheduler.runAfter(0, internal.researchActions.run, {
      runId,
      companyId,
      jurisdiction,
    });
    return runId;
  },
});

// Companies for the "Recent" picker, deduped to one row per company name
// (the newest) with its latest run's jurisdiction/status/time attached —
// pure UI-support query, no new data: everything here is already stored.
// Without the dedup, re-researching the same company repeatedly (a normal
// thing to do to compare jurisdictions) fills "Recent" with a wall of
// identically-named entries.
export const recentCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").order("desc").take(50);
    const seenNames = new Set<string>();
    const deduped = companies
      .filter((c) => {
        const key = c.name.trim().toLowerCase();
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      })
      .slice(0, 12);

    return await Promise.all(
      deduped.map(async (c) => {
        const latestRun = await ctx.db
          .query("researchRuns")
          .withIndex("by_companyId", (q) => q.eq("companyId", c._id))
          .order("desc")
          .first();
        return {
          companyId: c._id,
          name: c.name,
          requestedJurisdiction: latestRun?.requestedJurisdiction ?? null,
          status: latestRun?.status ?? null,
          at: latestRun?.finishedAt ?? latestRun?.startedAt ?? c.createdAt,
        };
      }),
    );
  },
});

// Shared by listByCompany and the standalone listActiveRegimeExposures query
// below (queries can't call other queries directly in Convex, so this is a
// plain helper both take ctx into).
async function getActiveRegimeExposures(
  ctx: QueryCtx,
  companyId: Id<"companies">,
  jurisdiction?: string,
) {
  const exposures = await ctx.db
    .query("companyRegimeExposure")
    .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
    .collect();

  const active = exposures.filter((e) => e.status === "active");

  type ActiveExposure = {
    exposure: Doc<"companyRegimeExposure">;
    regime: Doc<"regulatoryRegimes">;
  };

  const joined = await Promise.all(
    active.map(async (exposure): Promise<ActiveExposure | null> => {
      const regime = await ctx.db.get(exposure.regimeId);
      return regime ? { exposure, regime } : null;
    }),
  );

  return joined
    .filter((row): row is ActiveExposure => row !== null)
    .filter((row) => !jurisdiction || row.regime.jurisdiction === jurisdiction)
    .sort((a, b) => b.exposure.lastConfirmedAt - a.exposure.lastConfirmedAt);
}

export const listActiveRegimeExposures = query({
  args: {
    companyId: v.id("companies"),
    jurisdiction: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, jurisdiction }) =>
    getActiveRegimeExposures(ctx, companyId, jurisdiction),
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

    const profiles = await ctx.db
      .query("companyProfiles")
      .withIndex("by_companyId", (q) => q.eq("companyId", companyId))
      .order("desc")
      .collect();

    const latestRun = runs[0] ?? null;
    const activeRegimeExposures = await getActiveRegimeExposures(
      ctx,
      companyId,
      latestRun?.requestedJurisdiction,
    );

    return {
      latestRun,
      runs,
      findings,
      profile: profiles[0] ?? null,
      activeRegimeExposures,
    };
  },
});

export const recordProfile = internalMutation({
  args: {
    companyId: v.id("companies"),
    researchRunId: v.id("researchRuns"),
    primarySector: v.string(),
    secondarySectors: v.array(v.string()),
    businessModel: v.string(),
    keyProducts: v.array(v.string()),
    geographicFootprint: v.array(v.string()),
    regulatoryExposureAreas: v.array(v.string()),
    reasoning: v.string(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("companyProfiles", { ...args, createdAt: Date.now() });
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
        itemType: itemTypeValidator,
        regimeKey: v.optional(v.string()),
        status: regulatoryStatusValidator,
        applicabilityLevel: applicabilityLevelValidator,
        applicabilityConfidence: v.number(),
        applicabilityEvidence: applicabilityEvidenceValidator,
        sourceQuality: sourceQualityValidator,
        publicationDate: v.optional(v.string()),
        effectiveDate: v.optional(v.string()),
        implementationDate: v.optional(v.string()),
        consultationDeadline: v.optional(v.string()),
        reportingDeadline: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { companyId, researchRunId, findings }) => {
    const run = await ctx.db.get(researchRunId);
    const now = Date.now();

    for (const finding of findings) {
      const findingId = await ctx.db.insert("findings", {
        companyId,
        researchRunId,
        createdAt: now,
        ...finding,
      });

      if (!isLedgerEligible(finding) || !finding.regimeKey) continue;

      const ledgerJurisdiction = run?.requestedJurisdiction ?? finding.jurisdiction;
      const identity = canonicalRegimeIdentity(finding.regimeKey, ledgerJurisdiction);
      const bestSourceUrl = finding.sources[0]?.url;

      let regime = await ctx.db
        .query("regulatoryRegimes")
        .withIndex("by_jurisdiction_identity", (q) =>
          q.eq("jurisdiction", ledgerJurisdiction).eq("canonicalIdentity", identity),
        )
        .unique();

      let regimeId: Id<"regulatoryRegimes">;
      if (regime) {
        regimeId = regime._id;
        await ctx.db.patch(regimeId, {
          regimeKey: finding.regimeKey,
          regulator: finding.regulator,
          regulatoryArea: finding.regulatoryArea,
          lastSeenAt: now,
          ...(finding.sourceQuality === "TIER_1_REGULATOR_GOVERNMENT" || !regime.canonicalSourceUrl
            ? { canonicalSourceUrl: bestSourceUrl ?? regime.canonicalSourceUrl }
            : {}),
        });
      } else {
        regimeId = await ctx.db.insert("regulatoryRegimes", {
          jurisdiction: ledgerJurisdiction,
          regimeKey: finding.regimeKey,
          canonicalIdentity: identity,
          regulator: finding.regulator,
          regulatoryArea: finding.regulatoryArea,
          canonicalSourceUrl: bestSourceUrl,
          firstSeenAt: now,
          lastSeenAt: now,
        });
      }

      await ctx.db.patch(findingId, { regimeId });

      const existingExposure = await ctx.db
        .query("companyRegimeExposure")
        .withIndex("by_companyId_regimeId", (q) =>
          q.eq("companyId", companyId).eq("regimeId", regimeId),
        )
        .unique();

      if (existingExposure) {
        await ctx.db.patch(existingExposure._id, {
          applicabilityLevel: finding.applicabilityLevel,
          applicabilityEvidence: finding.applicabilityEvidence,
          status: "active",
          lastConfirmedAt: now,
          lastResearchRunId: researchRunId,
          lastFindingId: findingId,
        });
      } else {
        await ctx.db.insert("companyRegimeExposure", {
          companyId,
          regimeId,
          applicabilityLevel: finding.applicabilityLevel,
          applicabilityEvidence: finding.applicabilityEvidence,
          status: "active",
          firstIdentifiedAt: now,
          lastConfirmedAt: now,
          lastResearchRunId: researchRunId,
          lastFindingId: findingId,
        });
      }
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
