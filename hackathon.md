# Hackathon log

- **Project:** RegVista
- **Event:** Convex All Gas Hackathon
- **What it does:** Enter a company, optionally scope it to a jurisdiction
  (Singapore/EU/UK/US/Australia/India/China, or Global/Auto-detect), and see
  its regulatory landscape — an inferred sector/exposure profile, its active
  regulatory regimes (e.g. GDPR), upcoming/changing rules, and recent
  enforcement/developments, each evidence-backed with a relevance score,
  applicability, and "why this matters," plus an emailed briefing.
- **Live app:** https://brilliant-roadrunner-68.convex.site
- **Repo:** https://github.com/rajgopalakrish/RegVista_CVH
- **Frontend:** Convex static hosting
- **Convex deployment:** https://brilliant-roadrunner-68.convex.cloud
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, indexes, queries, mutations, internal mutations, actions, internal actions, scheduled functions, realtime queries
- **Auth:** none
- **AI models:** gpt-4.1-mini (direct OpenAI SDK, two calls per run: company profiling, then classification — not the Convex AI Gateway)
- **Started:** 2026-09-05T07:16:49Z
- **Last updated:** 2026-09-06T04:12:20Z

## Log

### 2026-09-05 - 78adf31
Scaffolded the repo with a README and `.gitignore`.

### 2026-09-05 - e81bb9e
Documented the Convex All Gas Hackathon requirements in the README (Convex
backend, Firecrawl data, AgentMail inbox, public repo, `convex.site`/
`chatgpt.site` hosting, Sept 22 deadline).

### 2026-09-05 - a9fc785
Installed the `convex-hackathon-skill` into `.claude/skills/` and reformatted
this log to its expected header/entry format.

### 2026-09-05 - fe806c5
Built the RegVista MVP scaffold end to end. Convex schema for `companies`,
`researchRuns`, and `findings`, each indexed `by_companyId`
(`convex/schema.ts`). `companies.ts` adds create/get/list; `research.ts` adds
a `start` mutation that schedules a research run via `ctx.scheduler` plus a
reactive `listByCompany` query and the internal mutations that record
findings and update run status. `researchActions.ts` (Node action) calls
Firecrawl's `search` for primary-source content on a company, then OpenAI
(`gpt-4.1-mini`, structured output via a Zod schema) to extract regulatory
findings, dropping any finding that isn't backed by a source URL.
`notify.ts` (Node action) sends the current findings for a company as a
briefing email through AgentMail (`client.inboxes.messages.send`). The React
frontend (`src/App.tsx`) is a company picker plus a reactive landscape view
wired to these functions via `useQuery`/`useMutation`/`useAction`. Frontend
and Convex functions both typecheck (`tsc -b`) and `vite build` succeeds;
the Firecrawl/OpenAI/AgentMail calls themselves are not yet exercised
end-to-end, which needs a live Convex deployment and API keys.

### 2026-09-05 - 7dac1e6
Documented that the sandbox's network policy was initially rejecting
outbound calls to Convex, OpenAI, Firecrawl, and AgentMail alike — an
environment-level network policy issue, not a credentials problem.

### 2026-09-05 - 3819046
Widened the network policy and ran the first real `npx convex deploy`
against a live dev deployment. Fixed two real deploy-time issues: an
unresolved optional dependency (`@x402/fetch`) inside `agentmail`'s bundle
for a payment feature the app never uses, and a typecheck failure from
Convex's real generated `Env` type not covering dashboard-set secrets
(reverted `researchActions.ts`/`notify.ts` to plain `process.env`, added
`@types/node`). `convex/_generated` is now the real server-generated
output.

### 2026-09-05 - 845ffb8
Fixed two more environment-specific issues (Node's `fetch` needing
`--use-env-proxy` to honor the sandbox's proxy; the Convex CLI's
WebSocket-based commands hanging in this sandbox) and verified the live
product end to end through the same plain-HTTPS API the frontend uses:
researching a real company (Stripe) produced 6 findings, each with a real
regulator, jurisdiction, relevance score, "why it matters," and at least
one live source URL (stripe.com, docs.stripe.com, stripe.training) — no
mocked data. Confirmed persistence and reactive status transitions
(pending → running → done). Sent a real AgentMail briefing for that run
and confirmed it was delivered to an inbox.

### 2026-09-05 - 59505a5 / f2e945c
Deployed the frontend to Convex static hosting. Registered
`@convex-dev/static-hosting` in `convex/convex.config.ts` (component owns
the root at `/`; no existing `http.ts` routes to preserve) and added an
`npm run deploy` script. `npx @convex-dev/static-hosting upload --build`
built the frontend with the real deployment's `VITE_CONVEX_URL` baked in
and published it — the app is now live at
`https://brilliant-roadrunner-68.convex.site`, verified serving the real
`index.html`/JS/CSS (HTTP 200s) with the correct Convex deployment URL
inside the built bundle. Full in-browser reactive verification (the
WebSocket `useQuery` path) isn't possible from this build sandbox — its
egress proxy doesn't support WebSocket upgrades at all, confirmed via a
Playwright/Chromium session against the live URL and documented in the
proxy's own troubleshooting notes; the underlying functions it would call
were already verified live via direct HTTPS calls to the same deployment.

### 2026-09-05 - cbbd79a
Fixed a real quality problem in the research pipeline (`researchActions.ts`):
every finding for "Google" was citing only Google's own marketing pages
(`cloud.google.com/compliance`, a Workspace security whitepaper) with vague
"regulator" values like "various bodies", yet scored 7-10/10. Root cause:
one generic Firecrawl query that a company's own marketing pages dominate
by ordinary SEO, and a prompt that never distinguished "mentions
regulation" from "describes an obligation imposed by an outside authority".
Replaced it with two targeted queries (enforcement/investigation vs.
regulation/law/license), added a required `sourceCategory` classification
to OpenAI's structured output so company marketing/ISO/SOC 2 pages get
tagged and dropped rather than treated as findings, and a code-side minimum
relevance-score threshold so a finding needs real evidence, not just a
source URL, to be kept. Re-running research for Google on the live
deployment went from 6/6 marketing-page findings to 4 findings backed by
`justice.gov` (DOJ antitrust remedies), credible reporting on a CNIL GDPR
fine, and Financial Times coverage of EU Digital Markets Act enforcement —
one borderline finding (Google's own ad-certification policy) remains,
honestly scored at the threshold rather than inflated.

### 2026-09-06 - fa3b851
Redesigned the pipeline around `Company → sector/exposure profile →
exposure-driven retrieval → classification (regime vs. supporting signal) →
applicability → evidence`, since results still read as regulatory news
research rather than a genuine landscape. Added a `companyProfiles` table
and a first OpenAI call (`researchActions.ts`) that infers sector, business
model, geographic footprint, and regulatory exposure areas from the company
name alone — a lightweight exposure map, not corporate intelligence.
Firecrawl queries are now built from that profile's own exposure areas and
jurisdictions (five queries: regime/law, guidance/consultation, enforcement,
a second exposure area, implementation/effective-date) instead of one
generic query. `findings` gained an ontology: `itemType` (REGULATION_REGIME
is first-class; GUIDANCE/CONSULTATION/PROPOSED_RULE/IMPLEMENTATION/
ENFORCEMENT/NEWS/COMPANY_POLICY are supporting signals), `regimeKey`
(links a development back to its regime), `status` (in-force vs.
future/proposed vs. guidance vs. enforcement), `applicabilityLevel`/
`applicabilityConfidence`, and `sourceQuality`. The frontend now groups the
latest run into Active Regulatory Regimes / Upcoming or Changing / Recent
Regulatory Developments plus a company-profile card, instead of one flat
list. Fixed two real bugs found by running this live: OpenAI's
structured-output API rejects Zod `.optional()` (needs `.nullable()`), and
the profiling model returned confidence as a 0-1 fraction despite the
0-100 instruction. Verified live against Google (EU exposure) — GDPR, the
UK Online Safety Act, and the EU-US Data Privacy Framework now surface as
first-class regimes, with a CNIL fine correctly demoted to a supporting
enforcement development tagged to GDPR — and DBS Bank (Singapore) — MAS
capital-adequacy regulation, an HKMA AML/CTF enforcement action, and
Bangladesh banking oversight, a completely different regulatory domain set
driven entirely by the inferred profile.

### 2026-09-06 - 1fbfded
Added an optional jurisdiction selector (`convex/schema.ts`'s
`JURISDICTIONS`: Singapore, EU, UK, US, Australia, India, China — a plain
array, easy to extend) to the existing form, alongside a "Jurisdiction:"
line in the landscape header. `researchRuns` gained `requestedJurisdiction`.
The key behavior: when a jurisdiction is selected, it *replaces* the
profile-derived jurisdiction in every Firecrawl query (`researchActions.ts`)
instead of retrieving globally and filtering afterward — auto-detect keeps
the prior behavior unchanged. Also did a focused source-quality cleanup: a
general `isUsableSource` filter drops noisy auto-generated-looking source
titles before they can be cited, `sourceAuthorityRank` sorts each finding's
sources so a `.gov`/regulator-domain source reads as primary evidence, and
the `sourceQuality` field's own prompt description got concrete good/bad
examples after testing showed the model mislabeling a private compliance
vendor site as TIER_1. Verified live: ByteDance + European Union produced
5/5 EU-scoped findings (DSA and GDPR as TIER_1 regimes from
`ec.europa.eu`/`dataprotection.ie`, the real €530M Irish DPC GDPR fine as a
supporting enforcement item) with none of the profile's US/China/India
footprint leaking in; DBS Bank + Singapore produced an MAS AML/CFT
enforcement action naming DBS specifically, the Payment Services Act, and
Basel III implementation; Stripe + Global/Auto-detect reproduced the
pre-existing US/EU/UK multi-jurisdiction discovery unchanged.

### 2026-09-06 - 8bac979
User review of a real ByteDance + European Union run caught the product's
one remaining trust problem: the DMA finding stated "ByteDance, designated
as a gatekeeper with respect to TikTok in the EU…" as settled fact, sourced
only from a private compliance-vendor blog — a specific regulatory
designation asserted from general LLM knowledge rather than retrieved
evidence. Added a new `applicabilityEvidence` axis (`schema.ts`:
`DIRECTLY_EVIDENCED`/`STRONGLY_INFERRED`/`POSSIBLE_UNCERTAIN`), orthogonal
to `applicabilityLevel` (how central the exposure is, unchanged), with a
detailed field description and a sharpened classification prompt requiring
hedged wording ("may be considered…", "is potentially subject to…")
whenever a specific designation/license/threshold/enforcement claim isn't
directly evidenced.

Live retest proved prompt-only enforcement insufficient: the model
correctly self-tagged the DMA finding `STRONGLY_INFERRED`, but its own
`summary`/`whyItMatters` prose still asserted the gatekeeper designation as
unhedged fact — the exact reported bug, still present after the schema/
prompt fix alone. Added a code-side backstop in `researchActions.ts`: a
general (non-company-specific) regex over designation-claim terms
("gatekeeper", "VLOP", "VLOSE", "designated as", "licensed", "fined", etc.)
crossed against common hedge words, which prepends an honest, always-true
evidence caveat to `summary` and/or `whyItMatters` whenever
`applicabilityEvidence` isn't `DIRECTLY_EVIDENCED` and the text still reads
as unhedged fact — rather than risk rewriting the model's sentence.
Nothing in the fix references ByteDance, TikTok, DMA, DSA, or GDPR by name.

Verified live: re-running ByteDance + European Union after the fix, DSA and
GDPR findings state applicability in general, non-designation terms and
came back uncaveated (correctly — they don't assert an unconfirmed
specific status); the two enforcement findings backed by the Irish DPC's
real €530M fine (`dataprotection.ie`) came back `DIRECTLY_EVIDENCED` and
uncaveated. The DMA finding's `summary` and `whyItMatters` now both open
with the evidence caveat instead of asserting the gatekeeper designation as
fact. The run still returned 8 useful findings overall (DMA, DSA, 3 GDPR
items, an EU consumer-protection complaint, the Disinformation Code of
Practice, and a GDPR procedural-regulation proposal) — the guardrail added
honesty without deleting uncertain-but-useful results.
