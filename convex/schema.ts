import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// A regulation/regime is a first-class landscape item; everything else is a
// supporting signal about one (or about the company generally, when it
// can't be tied to a specific regime). See docs/product-spec.md.
export const ITEM_TYPES = [
  "REGULATION_REGIME",
  "GUIDANCE",
  "CONSULTATION",
  "PROPOSED_RULE",
  "IMPLEMENTATION",
  "ENFORCEMENT",
  "NEWS",
  "COMPANY_POLICY",
] as const;
export const itemTypeValidator = v.union(
  ...ITEM_TYPES.map((t) => v.literal(t)),
);

// Whether an established regime currently imposes obligations, is only
// upcoming/proposed, or the item is guidance/enforcement rather than a
// regime status at all. An established regulation with active enforcement
// news is PASSED_PENDING_OR_ONGOING_OBLIGATIONS, never FUTURE_OR_PROPOSED.
export const REGULATORY_STATUSES = [
  "PASSED_NO_ACTIVE_OBLIGATIONS",
  "PASSED_PENDING_OR_ONGOING_OBLIGATIONS",
  "FUTURE_OR_PROPOSED",
  "GUIDANCE_INTERPRETATION",
  "ENFORCEMENT_DEVELOPMENT",
] as const;
export const regulatoryStatusValidator = v.union(
  ...REGULATORY_STATUSES.map((s) => v.literal(s)),
);

export const APPLICABILITY_LEVELS = [
  "CORE_EXPOSURE",
  "ADJACENT_EXPOSURE",
  "MONITOR_ONLY",
] as const;
export const applicabilityLevelValidator = v.union(
  ...APPLICABILITY_LEVELS.map((a) => v.literal(a)),
);

export const SOURCE_QUALITY_TIERS = [
  "TIER_1_REGULATOR_GOVERNMENT",
  "TIER_2_OFFICIAL_GUIDANCE_CONSULTATION",
  "TIER_3_SECONDARY_REPORTING",
] as const;
export const sourceQualityValidator = v.union(
  ...SOURCE_QUALITY_TIERS.map((t) => v.literal(t)),
);

// A starter set of jurisdictions a user can explicitly scope research to.
// "Global / Auto-detect" isn't in this list — it's the absence of a
// requested jurisdiction (research.start's `jurisdiction` arg is optional),
// so adding a new one here is the only change needed to offer it.
export const JURISDICTIONS = [
  "Singapore",
  "European Union",
  "United Kingdom",
  "United States",
  "Australia",
  "India",
  "China",
] as const;
export const jurisdictionValidator = v.union(
  ...JURISDICTIONS.map((j) => v.literal(j)),
);

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
    // Unset = Global / Auto-detect (the profile's own geographic footprint
    // drives retrieval). Set = that jurisdiction becomes the primary
    // research scope for this run.
    requestedJurisdiction: v.optional(jurisdictionValidator),
  }).index("by_companyId", ["companyId"]),

  // A lightweight exposure map, not a full company-intelligence profile —
  // refreshed each research run, one row per company (latest wins).
  companyProfiles: defineTable({
    companyId: v.id("companies"),
    researchRunId: v.id("researchRuns"),
    primarySector: v.string(),
    secondarySectors: v.array(v.string()),
    businessModel: v.string(),
    keyProducts: v.array(v.string()),
    geographicFootprint: v.array(v.string()),
    regulatoryExposureAreas: v.array(v.string()),
    reasoning: v.string(),
    confidence: v.number(), // 0-100
    createdAt: v.number(),
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

    // Regulatory ontology fields. Optional at the table level so existing
    // pre-ontology documents (written before this field set existed) stay
    // valid; convex/research.ts's recordFindings mutation requires them
    // non-optionally for every new write going forward.
    itemType: v.optional(itemTypeValidator),
    // Free-text short name of the regime this item belongs to or supports
    // (e.g. "GDPR", "EU DSA") — best-effort grouping, not a foreign key.
    regimeKey: v.optional(v.string()),
    status: v.optional(regulatoryStatusValidator),
    applicabilityLevel: v.optional(applicabilityLevelValidator),
    applicabilityConfidence: v.optional(v.number()), // 0-100
    sourceQuality: v.optional(sourceQualityValidator),
    // Free-text, not parsed timestamps: sources rarely give a precise date,
    // and forcing one invites fabrication (AGENTS.md §8).
    publicationDate: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    implementationDate: v.optional(v.string()),
    consultationDeadline: v.optional(v.string()),
    reportingDeadline: v.optional(v.string()),
  }).index("by_companyId", ["companyId"]),
});
