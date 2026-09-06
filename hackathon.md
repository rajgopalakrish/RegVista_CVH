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

### 2026-09-06 - 97669f1, b70716c
Final targeted quality pass on three real outputs (Google+Singapore,
TikTok+Singapore, ByteDance+EU) before freezing the regulatory core. Four
fixes, no schema/architecture changes:

1. Explicit jurisdiction is now a HARD scope, not a soft preference: added
   a code-side filter (`jurisdictionMatchesRequested`, with EU/UK/US-style
   aliases and word-boundary matching) that drops any finding whose
   jurisdiction doesn't match the one the user explicitly selected, before
   it's ever persisted — an EU DMA item can no longer surface in a
   Singapore run's landscape. A genuinely global/international item still
   passes through.
2. The "caveat but still assert the claim" bug from the previous pass: the
   old fix only prepended a disclaimer in front of the model's own
   unhedged sentence, so the DMA finding still read "...sources don't
   confirm this... [company] has been designated as a gatekeeper..." in
   one breath. Replaced with `neutralizeUnsupportedClaims`, which finds
   the actual offending sentence and rewrites it in place with a generic
   hedge built from the finding's own regime/area fields — no
   company/regulation-specific hardcoding.
3. Reset the jurisdiction dropdown after a successful submission in
   `App.tsx` so it can't read as if a previous company's jurisdiction still
   applies while viewing a different company's historical run (the
   displayed "Jurisdiction:" line already correctly read that run's own
   `requestedJurisdiction`, not form state).
4. Extended `sourceAuthorityRank` with a demoted tier for recognizable
   low-quality sources (Wikipedia, a `/blog/`-style vendor URL path, a
   company's own domain via `company.name`) without ever guessing at
   *promoting* an unfamiliar domain — so an unrecognized-but-legitimate
   regulator like `dataprotection.ie` is never penalized.

Verified live end-to-end after Firecrawl credits (briefly exhausted mid-pass,
then topped up) were restored: Google+Singapore returned only
Singapore-jurisdiction findings on two separate runs, with the second run
(after the source-ranking fix) correctly demoting `cloud.google.com` and
two `cookieyes.com/blog/...`-style vendor sources that the first run had
left unranked; ByteDance+EU's DMA finding now reads only the generic hedge
sentence with no "designated as a gatekeeper" assertion anywhere, while
DSA and all three GDPR findings remained useful and appropriately
supported; Stripe with Global/Auto-detect returned 8 findings spanning
Global/US/EU/UK, confirming multi-jurisdiction discovery is unaffected
when no jurisdiction is requested.

### 2026-09-06 - ffd13bc
Final regulatory-core cleanup pass: stopped `REGULATION_REGIME` items from
being invented out of broad regulatory topics — a prior live Stripe run
had produced items titled "US Payment System Regulation and Anti-Money
Laundering Oversight" and regime `"Sanctions and Export Controls Regime"`,
neither a real nameable instrument. Sharpened the `itemType`/`regimeKey`
field descriptions and system prompt so `REGULATION_REGIME` requires a
specific named law/regulation/code/notice (GDPR, PDPA, MAS Notice 637),
with the user's own examples of what's NOT a regime built in verbatim; a
`REGULATION_REGIME` item the model itself left `regimeKey` null on is
downgraded to `NEWS` in code (falls into the existing "Recent Regulatory
Developments" group, no new bucket). Also dropped the schema's "roughly
5-12" floor that likely pressured padding once real instruments ran out —
kept only a 12-item ceiling with explicit "fewer well-evidenced items
beats padding" framing. Source-provenance ordering and the applicability
evidence model needed no changes (both already correct from the prior
pass) and were re-verified, not regressed.

Verified live: Google+Singapore went from 3-4 findings including a filler
"Singapore Competition Act" item to 2 tightly-scoped PDPA findings with no
padding; TikTok+Singapore's regimes all carry specific names (including a
compound-but-genuinely-specific "Online Safety (Miscellaneous Amendments)
Act 2022 and Broadcasting Act 1994" citing two real acts, correctly kept)
with `pdpc.gov.sg`/`imda.gov.sg` correctly ordered ahead of TikTok's own
blog and a law firm's site; DBS Bank+Singapore confirmed primary-source
provenance (`mas.gov.sg` before a secondary news source) and surfaced one
residual non-empty-but-still-somewhat-generic regimeKey
(`"MAS AML/CFT Notice"`) that the null-check backstop doesn't catch —
documented as a known, intentionally not-chased-further gap rather than
risking a text-shape heuristic that could misclassify genuinely compound
specific citations; Stripe+Global/Auto-detect returned 9 findings across
US/UK/EU with no maximally-vague compound titles and applicability
hedging intact throughout.

### 2026-09-06 - c001243
Product polish pass: made RegVista read as a regulatory intelligence
terminal rather than a hackathon demo, with the regulatory core frozen
(no retrieval/classification/jurisdiction/applicability changes). One
backend addition, purely to expose already-stored data:
`research.recentCompanies` dedupes the Recent list by company name
(newest wins) and attaches each company's latest run jurisdiction/status/
time via the existing index — without it, re-researching a company (a
normal way to compare jurisdictions) filled Recent with duplicate rows.

Rewrote `App.tsx`/`index.css` for visual hierarchy, same data and
component responsibilities throughout: company name is now the visually
primary research field; the company profile reads as a labeled brief;
finding cards split their previously-crowded single badge row into a top
row, a plain meta line, and one combined applicability indicator (a
colored dot + level/evidence in one pill); sources carry an honest
sourceQuality-driven tag rather than an unverified "primary source"
label; the three finding sections each got a distinct accent color;
loading/empty/error states got real styling instead of bare text; the
AgentMail briefing form moved into its own card with a one-line
explanation.

Implemented the Regulatory Exposure Map: Company -> exposure-area lanes
(grouped by each finding's own `regulatoryArea`) -> regime chips tagged
with jurisdiction/regulator, colored Active (green) or Upcoming (amber)
by `status`, with a separate enforcement ring when another finding
sharing the same `regimeKey` is an enforcement development. Built
entirely from the current run's own `REGULATION_REGIME` findings — no
graph library, no new backend data, renders nothing when a run has no
named-regime findings. Clicking a chip scrolls to and briefly highlights
the matching finding card below.

Verified via `ConvexHttpClient` (this sandbox still can't tunnel the
WebSocket a real browser needs, same documented limitation as every prior
live-deployment pass): re-ran TikTok+Singapore (2 `REGULATION_REGIME`
findings across 2 exposure-area lanes) and Stripe+Global/Auto-detect (6
findings across 5 lanes, including one `ENFORCEMENT_DEVELOPMENT`-status
regime correctly rendering as both active and enforcement-ringed) —
confirming the map has real data to draw in both the jurisdiction-scoped
and auto-detect cases. `requestedJurisdiction` matched what was requested
on both runs. `recentCompanies` returned 8 distinct companies with zero
duplicates against this session's real accumulated test data. Frontend
and backend typecheck, and `npm run build`, all pass; the Convex backend
deployed successfully. The static-hosting frontend deploy still hits the
same pre-existing 403 documented in the two prior passes (unrelated to
this pass's code) — the live `convex.site` URL is not yet serving this
build, and full in-browser rendering couldn't be visually confirmed for
the same reason as before.

### 2026-09-06 - (package.json)
Root-caused and fixed the static-hosting deploy 403 that three prior
passes had logged as an unrelated pre-existing infra issue: the
`@convex-dev/static-hosting` CLI uploads files via a plain Node `fetch()`
call, and this sandbox's Node `fetch` doesn't honor `HTTPS_PROXY` without
the `--use-env-proxy` flag — the exact same root cause already documented
for ad-hoc test scripts, just never connected to the actual `deploy` npm
script. Fixed durably: `package.json`'s `deploy` script now runs with
`NODE_OPTIONS=--use-env-proxy` (a no-op anywhere without an `HTTPS_PROXY`
set, so harmless on the project owner's own machine). Verified `npm run
deploy` succeeds standalone and the live site
(`https://brilliant-roadrunner-68.convex.site`) now serves the current
build (200 on the page and both built assets) — including the product-
polish pass's UI and Regulatory Exposure Map, which had been committed
but never actually live until now.

### 2026-09-06 - (UI/evidence presentation cleanup)
Fixed three issues the user caught reviewing real Google + Singapore
output, UI-only, regulatory engine untouched (only `src/App.tsx`/
`src/index.css` changed): the sources block no longer labels the whole
list "Regulator / government source" when it can include company/vendor
domains — reworded to a neutral "Sources" header with the quality tag
moved to sit beside only the primary (already-sorted) source link;
secondary sources now collapse behind a "+N supporting sources"
disclosure instead of dumping every domain inline; and a new
presentation-only `presentApplicabilityText` helper softens definitive
applicability phrasing ("falls under", "is subject to", "must comply
with") in `summary`/`whyItMatters` at render time whenever
`applicabilityEvidence` isn't `DIRECTLY_EVIDENCED` and the sentence isn't
already hedged — the engine's own `neutralizeUnsupportedClaims` guardrail
only targets specific designation/license/fine claims, not this broader
phrasing, and this stays presentation-only rather than touching the
frozen engine. Caught and fixed a double-hedging bug in the first version
("falls under" → "may may fall under" from two sequential regex passes)
before shipping, by combining all phrases into a single regex pass;
re-verified against six representative sentences. Frontend typecheck,
backend typecheck (unaffected), and `npm run build` all pass.

### 2026-09-06 - d2e3529
Product finalization pass ("prototype toward v1") with the regulatory
engine explicitly frozen — confirmed via `git diff --stat` at the end
that zero `convex/*.ts` files were touched. Re-inspected real rendered
DBS+Singapore, Google+Singapore, and Stripe findings against nine
requirements (trust consistency, source presentation, the Exposure Map,
the company brief, finding cards, developments framing, demo-data
hygiene, cross-sector testing, and a final visual pass):

1. Widened the applicability-hedging logic after finding real gaps the
   prior pass's phrase list missed live: "falling under", bare "subject
   to" (no is/are before it), "is obligated", and "must apply"/"must
   implement" beyond just "must comply with". Found and fixed two real
   grammar bugs in the widened version before shipping — "will be subject
   to" and "is directly subject to" were both producing double modals —
   with a verb-deletion + hedge-insertion approach that never drops the
   words in between (so "directly" survives).
2. Decoupled the sourceQuality badge from whichever source link sorted
   first: live data showed a finding tagged TIER_1_REGULATOR_GOVERNMENT
   whose actual sources were all vendor/company domains, so pinning the
   tag to the sorted-first link would have mislabeled a non-regulator URL.
   Tag now reads as a finding-level fact next to "Sources," not a claim
   about one specific link.
3. Exposure Map judged already strong; added a per-lane count, made
   jurisdiction visually bolder than regulator in each chip, added a
   hover arrow. Left the lane-grouping key alone after finding real near-
   duplicate area labels fragmenting the map slightly (documented as a
   known limitation — a fuzzy-merge heuristic was rejected as too risky,
   same reasoning as the earlier regime-vs-topic pass).
4. Company profile confidence now leads with "High/Moderate/Low
   confidence" instead of a bare score (exact number still on hover).
5. Finding card jurisdiction bolded for clearer WHERE/WHO scanning.
6. Developments now show "Relates to {regimeKey}" using data that was
   already stored but never surfaced — ties enforcement/guidance/news
   items back to the regime they're about.
7. DB already held only DBS/Google/Stripe (verified live before assuming
   cleanup was needed — no test-artifact companies were present). Re-ran
   Stripe with Global/Auto-detect since its latest run had drifted to a
   United Kingdom-scoped run instead of the established multi-jurisdiction
   demo narrative.
9. Reworded a "check server logs" error message and simplified the
   results-page jurisdiction display; added a page meta description.

Verified: frontend typecheck and build clean, live site (200 on page +
both assets) now serves this build via the already-fixed `npm run
deploy`, and `git diff --stat` confirms the engine is untouched.
