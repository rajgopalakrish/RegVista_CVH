# RegVista — Architecture

## Stack

- **Backend/data**: Convex (schema, queries, mutations, actions, reactive
  subscriptions). System of record for companies, research runs, and
  findings.
- **Frontend**: Vite + React + TypeScript, using `convex/react` hooks
  (`useQuery`, `useMutation`, `useAction`). Deployed on Convex static
  hosting (`convex.site`) per hackathon requirements.
- **Data retrieval**: Firecrawl, called from a Convex `action` (actions are
  the only Convex function type allowed to make outbound network calls).
- **Structured reasoning**: OpenAI, called from the same action (or a
  follow-up internal action) to turn raw crawled content into typed
  `Finding` records.
- **Notifications**: AgentMail, called from a Convex `action` to send a
  briefing email built from the current findings for a company.

Rationale for Vite + React: it's the stack in Convex's own quickstart and
templates, keeps the surface area small (no server framework needed — Convex
is the backend), and is fast to get running for a 3-week hackathon.

## Convex schema (`convex/schema.ts`)

```ts
companies: {
  name: string
  industry?: string
  hqJurisdiction?: string
  website?: string
  createdAt: number
}

researchRuns: {
  companyId: Id<"companies">
  status: "pending" | "running" | "done" | "error"
  error?: string
  startedAt: number
  finishedAt?: number
  // Unset = Global / Auto-detect. One of JURISDICTIONS (schema.ts) when
  // the user explicitly scoped this run to a jurisdiction.
  requestedJurisdiction?: "Singapore" | "European Union" | "United Kingdom"
    | "United States" | "Australia" | "India" | "China"
}

companyProfiles: {
  companyId: Id<"companies">
  researchRunId: Id<"researchRuns">
  primarySector: string
  secondarySectors: string[]
  businessModel: string
  keyProducts: string[]
  geographicFootprint: string[]
  regulatoryExposureAreas: string[]
  reasoning: string
  confidence: number            // 0-100
  createdAt: number
}

findings: {
  companyId: Id<"companies">
  researchRunId: Id<"researchRuns">
  jurisdiction: string
  regulator: string
  regulatoryArea: string
  title: string
  summary: string
  relevanceScore: number        // 0-100
  whyItMatters: string
  sources: Array<{ url: string; title: string; retrievedAt: number }>
  createdAt: number

  // Regulatory ontology — optional at the table level so pre-ontology test
  // documents stay valid; convex/research.ts's recordFindings mutation
  // requires all of them for every new write.
  itemType?: "REGULATION_REGIME" | "GUIDANCE" | "CONSULTATION"
    | "PROPOSED_RULE" | "IMPLEMENTATION" | "ENFORCEMENT" | "NEWS"
    | "COMPANY_POLICY"
  regimeKey?: string             // e.g. "GDPR" — best-effort grouping, not a foreign key
  status?: "PASSED_NO_ACTIVE_OBLIGATIONS" | "PASSED_PENDING_OR_ONGOING_OBLIGATIONS"
    | "FUTURE_OR_PROPOSED" | "GUIDANCE_INTERPRETATION" | "ENFORCEMENT_DEVELOPMENT"
  applicabilityLevel?: "CORE_EXPOSURE" | "ADJACENT_EXPOSURE" | "MONITOR_ONLY"
  applicabilityConfidence?: number  // 0-100
  sourceQuality?: "TIER_1_REGULATOR_GOVERNMENT"
    | "TIER_2_OFFICIAL_GUIDANCE_CONSULTATION" | "TIER_3_SECONDARY_REPORTING"
  publicationDate?: string       // free text, e.g. "March 2025" — never a fabricated precise date
  effectiveDate?: string
  implementationDate?: string
  consultationDeadline?: string
  reportingDeadline?: string
}
```

The `itemType`/`status`/`applicabilityLevel`/`sourceQuality` unions are
defined once in `schema.ts` (`ITEM_TYPES`, `REGULATORY_STATUSES`, etc.) and
imported into both `research.ts`'s mutation validators and
`researchActions.ts`'s Zod schema, so the Convex schema and the OpenAI
structured-output schema can't drift apart.

Indexes: `companies` has no unique constraint on `name` for the MVP (a
company can be re-researched, producing a new run); `researchRuns`,
`companyProfiles`, and `findings` are indexed `by_companyId` for the
reactive per-company views.

## Convex functions

- `companies.ts`
  - `create` (mutation): insert a company, return its id.
  - `get` (query): fetch a company by id.
  - `list` (query): recent companies (for a simple picker/history).
- `research.ts`
  - `start` (mutation): create a `researchRuns` row in `pending` state,
    schedule the `run` action via `ctx.scheduler.runAfter`, return the run id.
  - `recordProfile` (internalMutation): persist the inferred company profile.
  - `recordFindings` (internalMutation): persist classified findings; its
    args validator requires the full ontology (itemType/status/
    applicability/sourceQuality) on every new write.
  - `listByCompany` (query): reactive findings + profile + run status for a
    company.
  - `run` (internalAction, in `researchActions.ts`) — three stages:
    1. **Company profiling**: one OpenAI call infers sector, business model,
       geographic footprint, and regulatory exposure areas from the
       company name (general knowledge, no retrieval — a lightweight
       exposure map, not corporate intelligence).
    2. **Exposure-driven retrieval**: Firecrawl queries are built from the
       profile's own exposure areas and jurisdictions (regime/law framing,
       guidance/consultation framing, enforcement framing, a second
       exposure area, implementation/effective-date framing) — nothing is
       hardcoded per company.
    3. **Classification**: one OpenAI call turns the deduped sources into
       typed findings — a regulation/regime is a first-class item;
       enforcement/news/guidance are supporting developments tied back to
       a regime via `regimeKey` where possible. Generic company marketing
       is its own classification bucket and is dropped in code, along with
       anything below a minimum relevance score, regardless of what the
       model returns.
- `notify.ts`
  - `sendBriefing` (action): render the current findings for a company into
    an email body and send via AgentMail to a user-supplied address.

Only actions touch Firecrawl/OpenAI/AgentMail. Queries and mutations stay
pure Convex, per Convex's own rules for reliable reactivity.

## Environment variables (never committed)

- `FIRECRAWL_API_KEY`
- `OPENAI_API_KEY`
- `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`

These are set via `npx convex env set <NAME> <value>` on the Convex
deployment, not in `.env` files that get bundled into the client.

## What still requires the user's own accounts/credentials

This session cannot complete Convex/Firecrawl/OpenAI/AgentMail account setup
on its own (interactive login, API keys). The following are prerequisites
the project owner must run locally, tracked here rather than assumed done:

1. `npx convex dev` (or `npx convex login` then `npx convex dev`) once, to
   create the deployment and generate `convex/_generated`.
2. Set the four env vars above on the Convex deployment.
3. Deploy the frontend to Convex static hosting for the public
   `convex.site` URL required by the hackathon.

## Verification approach

- TypeScript: `npm run typecheck` (frontend + Convex functions where
  possible without a live deployment's generated types).
- Build: `npm run build` for the Vite frontend.
- Convex functions that depend on `convex/_generated` (created by
  `npx convex dev`) are verified by the project owner locally, since this
  environment has no authenticated Convex deployment.
