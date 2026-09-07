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

// How well the *specific* applicability claim (not just the general
// exposure area) is actually backed by the retrieved evidence, as opposed
// to general LLM knowledge. A regime can be CORE_EXPOSURE (central to the
// business) while a specific designation/status claim about it is only
// STRONGLY_INFERRED or POSSIBLE_UNCERTAIN — these are separate axes.
export const APPLICABILITY_EVIDENCE_LEVELS = [
  "DIRECTLY_EVIDENCED",
  "STRONGLY_INFERRED",
  "POSSIBLE_UNCERTAIN",
] as const;
export const applicabilityEvidenceValidator = v.union(
  ...APPLICABILITY_EVIDENCE_LEVELS.map((e) => v.literal(e)),
);

// How current a forward-looking (consultation/proposed-rule/implementation,
// or a REGULATION_REGIME still FUTURE_OR_PROPOSED) item's classification
// actually is — distinct from `status` above, which only distinguishes an
// established regime's in-force state. Only ever computed for
// forward-looking items; an already-effective regime doesn't need this.
// FINALIZED/EFFECTIVE/WITHDRAWN/SUPERSEDED exist for a future pass that can
// establish a positive outcome (e.g. a real re-verification) — nothing in
// this pass ever assigns them, since doing so without evidence would be
// exactly the fabrication this field exists to prevent.
export const TEMPORAL_STATUSES = [
  "PROPOSED",
  "CONSULTATION",
  "FINALIZED",
  "EFFECTIVE",
  "WITHDRAWN",
  "SUPERSEDED",
  "STATUS_UNKNOWN",
] as const;
export const temporalStatusValidator = v.union(
  ...TEMPORAL_STATUSES.map((s) => v.literal(s)),
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
    // How well-evidenced the specific applicability claim is (distinct from
    // applicabilityLevel, which is how central the exposure is).
    applicabilityEvidence: v.optional(applicabilityEvidenceValidator),
    sourceQuality: v.optional(sourceQualityValidator),
    // Free-text, not parsed timestamps: sources rarely give a precise date,
    // and forcing one invites fabrication (AGENTS.md §8).
    publicationDate: v.optional(v.string()),
    effectiveDate: v.optional(v.string()),
    implementationDate: v.optional(v.string()),
    consultationDeadline: v.optional(v.string()),
    reportingDeadline: v.optional(v.string()),
    // Best-effort link to a stable ledger regime (below), set when this
    // finding cleared the ledger's credibility bar. Optional/backward
    // compatible: regimeKey (above) remains the free-text display link
    // for everything else.
    regimeId: v.optional(v.id("regulatoryRegimes")),

    // How current a forward-looking item's classification actually is —
    // see TEMPORAL_STATUSES above. `statusCheckAt` is when the engine's
    // deterministic staleness check ran (a date-arithmetic check against
    // dates already extracted from the source, never a live re-fetch) —
    // it is NOT evidence the item's real-world status was confirmed.
    // `lastVerifiedAt` is reserved for that stronger claim (e.g. a future
    // pass that actually re-checks the source) and is never set by the
    // staleness check alone; a finding with statusCheckAt but no
    // lastVerifiedAt has had its *freshness* checked, not its *status*
    // verified — the UI must keep that distinction visible.
    temporalStatus: v.optional(temporalStatusValidator),
    statusCheckAt: v.optional(v.number()),
    lastVerifiedAt: v.optional(v.number()),
  }).index("by_companyId", ["companyId"]),

  // The stable "regime ledger": relatively fixed named regulatory
  // instruments the engine has confidently identified at least once,
  // independent of any single research run. This exists to fix a
  // confirmed problem, not to become a general regulation database — a
  // real company+jurisdiction re-run was found to lose a genuinely-
  // applicable regime simply because that run's bounded Firecrawl query
  // budget didn't happen to touch it again (see docs/decisions.md). Only
  // regimes clearing the same credibility bar findings already require
  // (specific named instrument, decent relevance, non-secondary source,
  // not merely "possible/uncertain" — see LEDGER_MIN_RELEVANCE etc. in
  // research.ts) ever get written here, and only ever by the normal
  // research pipeline — never manually curated.
  regulatoryRegimes: defineTable({
    jurisdiction: v.string(),
    regimeKey: v.string(), // display name, as most recently confirmed
    canonicalIdentity: v.string(), // normalized matching key — see research.ts
    regulator: v.string(),
    regulatoryArea: v.string(),
    canonicalSourceUrl: v.optional(v.string()),
    // Every distinct source URL that has ever supported this canonical
    // regime — preserved across a dedup merge rather than collapsed to
    // just canonicalSourceUrl, so merging near-duplicate ledger rows into
    // one canonical regime never discards provenance the merged-away rows
    // contributed.
    sourceUrls: v.optional(v.array(v.string())),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_jurisdiction_identity", ["jurisdiction", "canonicalIdentity"]),

  // The stable claim "this company is exposed to this ledger regime" —
  // separate from any one run's `findings`, so a regime a run doesn't
  // happen to re-query still shows as part of the company's landscape.
  // `status` defaults to "active" and is never inferred from a run simply
  // not mentioning the regime again — only real contrary evidence would
  // ever move it to "stale"/"superseded" (not implemented yet; no code
  // path sets those today, they exist so a future pass can without a
  // schema change).
  companyRegimeExposure: defineTable({
    companyId: v.id("companies"),
    regimeId: v.id("regulatoryRegimes"),
    applicabilityLevel: applicabilityLevelValidator,
    applicabilityEvidence: applicabilityEvidenceValidator,
    status: v.union(v.literal("active"), v.literal("stale"), v.literal("superseded")),
    firstIdentifiedAt: v.number(),
    lastConfirmedAt: v.number(),
    lastResearchRunId: v.id("researchRuns"),
    lastFindingId: v.id("findings"),
  })
    .index("by_companyId", ["companyId"])
    .index("by_companyId_regimeId", ["companyId", "regimeId"]),
});
