# RegVista — Decisions log

Newest last.

## 2026-09-05 — Adopted AGENTS.md as the working contract

Source of truth for product principle (company-centric, not RegLens),
scope discipline, and required stack. All subsequent decisions below trace
back to it.

## 2026-09-05 — Frontend stack: Vite + React + TypeScript

Chosen because it's Convex's own quickstart stack (least glue code), builds
fast, and deploys cleanly to Convex static hosting. Rejected: a heavier
meta-framework (Next.js) — unnecessary for a single-page reactive app and
adds server-rendering concerns Convex doesn't need.

## 2026-09-05 — MVP trigger is manual, not scheduled monitoring

AgentMail's "monitoring/briefing" requirement is satisfied for the MVP with
an on-demand "email me this briefing" action. Continuous scheduled
monitoring (Convex crons + diffing findings over time) is a natural v2 and
is explicitly deferred — see docs/product-spec.md "MVP scope (out)" — to
keep the hackathon build small and reliable per AGENTS.md §6/§9.

## 2026-09-05 — Data model: companies / researchRuns / findings

Three tables, no auth. A `researchRun` groups the findings produced by one
research pass so the UI can show "in progress" / "done" / "error" state
reactively instead of guessing from the presence of findings. Every
`finding` embeds its own `sources` array rather than a separate sources
table — for the MVP's scale (one company, one run at a time) a normalized
sources table would be premature.

## 2026-09-05 — Only Convex actions call external APIs

Firecrawl, OpenAI, and AgentMail calls all live in `action`/`internalAction`
functions, never in queries or mutations. This is a Convex platform
requirement (queries/mutations must be deterministic and side-effect-free)
and also keeps the untrusted-content boundary (AGENTS.md §8) in one place.

## 2026-09-05 — Superseded: use `process.env`, not generated `env` (see below)

An earlier version of this entry said to use the `env` export from
`_generated/server.ts` instead of `process.env`, to sidestep a local
`@types/node` typecheck issue. The real `npx convex deploy` proved that
wrong: Convex's generated `Env` type only includes vars it can prove are
declared (the two platform vars, plus anything declared in
`convex.config.ts`) — it does **not** know about dashboard-set secrets like
`FIRECRAWL_API_KEY`. Indexing it with an arbitrary string
(`env[name]`) failed the deploy's own typecheck with "No index signature ...
on type Env". Runtime evidence from an actual deployment beat the earlier
local-only assumption (AGENTS.md §4 priority order).

Fixed by reverting `researchActions.ts` and `notify.ts` to plain
`process.env[name]` — the standard way every real Convex Node action reads
runtime secrets — and instead solving the original problem directly: added
`@types/node` as a devDependency and `"types": ["node"]` to both
`convex/tsconfig.json` and `tsconfig.app.json`. The frontend needs it too
because it type-imports `../convex/_generated/api`, which pulls every
`convex/*.ts` file (including the two `"use node"` action files) into the
same type-check, so both projects need to agree that `process` exists.

## 2026-09-05 — This sandbox cannot reach Convex, Firecrawl, OpenAI, or AgentMail

`npx convex deploy` failed with a bare `fetch failed` even with a valid dev
deploy key. Checking the agent proxy (`curl $HTTPS_PROXY/__agentproxy/status`)
showed the real cause: this session's outbound network policy rejects the
CONNECT tunnel (403, "policy denial") to `api.convex.dev`,
`*.convex.cloud`, `dashboard.convex.dev`, `api.openai.com`,
`api.firecrawl.dev`, and `api.agentmail.to` alike. This is an
organization-level egress allowlist for this Claude Code Remote
environment (chosen when the environment was created), not something fixable
by retrying, changing credentials, or code changes — the agent proxy's own
README explicitly says not to retry a 403 policy denial. All four required
services are unreachable from here, so no live call in the pipeline
(deploy, research, or briefing) can be exercised from this sandbox as
configured. Live verification needs to run somewhere with egress to those
four domains — the project owner's machine, or a Claude Code environment
whose network policy allows them.

## 2026-09-05 — Network egress unblocked; live deploy now working

The earlier "sandbox can't reach Convex/OpenAI/Firecrawl/AgentMail" blocker
was resolved by switching this Claude Code environment's network access
from Trusted to Custom, explicitly allowlisting `api.convex.dev`,
`*.convex.cloud`, `dashboard.convex.dev`, `convex.site`, `*.convex.site`,
`api.openai.com`, `api.firecrawl.dev`, and `api.agentmail.to`. Verified with
direct `curl` checks before retrying the deploy.

## 2026-09-05 — Added `@x402/fetch` as a direct dependency

`npx convex deploy`'s esbuild bundling step failed with `Could not resolve
"@x402/fetch"` inside `agentmail`'s wrapper client. Reading
`node_modules/agentmail/dist/esm/wrapper/Client.mjs` showed why: the
package does an optional dynamic `import("@x402/fetch")` for an opt-in
crypto-payment feature (`options.x402`) we never pass to `AgentMailClient`.
The import is real code, not dead code, so esbuild still tries to resolve
it at bundle time even though it never runs for us.

Convex's `convex.json` `node.externalPackages` list looked like the fix,
but reading `node_modules/convex/dist/cjs/bundler/external.js` showed it
only marks a package external if it's *already installed* — it doesn't
help for a package that's referenced but never installed at all. Given
that, the smallest reliable fix was to actually install `@x402/fetch`
(pulls in only `@x402/core`, both pure JS, no native deps) so esbuild can
resolve it; the code path that would use it still never executes.

## 2026-09-05 — Node's built-in `fetch` needs `--use-env-proxy` in this sandbox

Testing the live pipeline with a plain Node script (`ConvexHttpClient` over
HTTPS, no WebSocket) failed with a confusing `Host not in allowlist:
brilliant-roadrunner-68.convex.cloud` error — but the identical request via
`curl` succeeded. Cause: `curl` honors `HTTPS_PROXY` automatically; Node's
built-in `fetch` (undici) does not, unless run with the (experimental)
`--use-env-proxy` flag or an explicit `ProxyAgent`. Without it, Node
attempted a direct connection that a different, lower-level network
boundary rejected with that message — unrelated to the Claude Code
environment's network access setting, which only governs the
`HTTPS_PROXY`-based path. Any local Node script that calls external APIs
directly from this sandbox needs `node --use-env-proxy ...`.

Separately: the Convex CLI's WebSocket-based commands (`convex run`, and
apparently `env list`) hang indefinitely retrying a WebSocket connection
that never succeeds in this sandbox, even with the network policy widened —
looks like the proxy doesn't tunnel WS upgrades the same way it tunnels
plain HTTPS. Worked around this by testing the live app via
`ConvexHttpClient` (plain HTTPS, the same public API our frontend uses)
instead of the CLI's admin commands.

## 2026-09-05 — Static hosting deploy needs a deploy key with function-run scope

`@convex-dev/static-hosting deploy`/`upload` both fail with the generic
"Could not reach component" message. Running the underlying command
directly (`npx convex run --component staticHosting lib:getUrls ...`)
surfaced the real error: `You do not have permission to perform this
operation (deployment:functions:runInternalQueries)`. The tool resolves
the component's live URL by running one of its internal queries, which
needs that scope on `CONVEX_DEPLOY_KEY` — our current key was created
without it. Backend `npx convex deploy` still works fine (only needs
`deployment:deploy`). Needs a new deploy key with at least
`deployment:functions:runInternalQueries` (and, per the earlier
recommendation, the rest of the Functions/Data/Logs scopes) to proceed.

## 2026-09-05 — WebSocket is a hard limitation of this sandbox, confirmed definitively

Tried to verify the deployed frontend with a real headless Chromium
(Playwright) session, proxied through this sandbox's egress proxy. The page
request itself reset mid-handshake (`ws_closed_mid_exchange` on
`brilliant-roadrunner-68.convex.site`), reproducible even with HTTP/2 and
QUIC disabled in Chromium. `/root/.ccr/README.md`'s own troubleshooting
section settles it under "Not supported through the proxy (report, do not
work around)": **WebSocket upgrades** are explicitly unsupported, alongside
HTTP/2-only APIs and a few other protocols. This is the same root cause as
the earlier "Convex CLI commands hang" finding — `convex run`/`env list`
and Convex's reactive client (`ConvexReactClient`, used by every `useQuery`
in the app) both depend on a WebSocket to the deployment, which this
sandbox cannot tunnel at all, not merely slowly.

Practical effect: this sandbox can verify a Convex app's plain-HTTPS
surface (page load, static assets, `ConvexHttpClient` query/mutation/action
calls — proven working, see the "real deployment" entries above) but
**cannot** exercise the reactive, WebSocket-driven behavior a real browser
session would use once React mounts and calls `useQuery`. That gap needs
either a different network environment or the project owner's own browser.

## 2026-09-05 — Fixed research pipeline treating company marketing as regulatory findings

Live evidence (querying the existing "Google" company on the real
deployment) showed all 6 stored findings cited only `cloud.google.com`,
`workspace.google.com`, and `developers.google.com` — Google Cloud selling
compliance-as-a-feature to its own customers, not Google's own regulatory
obligations — yet scored 7-10/10 with vague `regulator` values like
"Various regulatory authorities" and "ISO and other standards bodies".

Root cause: `researchActions.ts` ran one generic Firecrawl query
(`"<company> <industry> regulatory compliance regulator"`), which a
company's own marketing pages dominate for ordinary SEO reasons (nobody
outranks a company on searches about itself), and the OpenAI prompt never
told the model to distinguish "mentions regulation" from "describes an
obligation imposed by an outside authority" — so any source using
regulatory-sounding language got extracted and scored highly.

Fix (all in `researchActions.ts`, no schema/UI changes):
- Two targeted queries instead of one — enforcement/investigation framing
  and regulation/law/license framing — replacing the generic "compliance"
  framing that favored marketing pages. Deduped by URL, capped at 10
  sources.
- Added a required `sourceCategory` field to the model's structured output
  (`regulator_or_government` / `regulatory_enforcement_or_legal_news` /
  `company_regulatory_disclosure` / `generic_compliance_marketing`) with an
  explicit rubric, and a `relevanceScore` field with a described 0-100
  rubric tied to how binding/authoritative the finding actually is.
- System/user prompts now explicitly state RegVista's promise and give
  concrete negative examples (ISO/SOC 2 marketing, cloud "compliance
  support" pages, security whitepapers) so the model has a real basis to
  reject them instead of just being told "don't fabricate."
- Code-side backstop, independent of the model's own compliance: drop any
  finding categorized `generic_compliance_marketing`, and drop any finding
  scoring below `MIN_RELEVANCE_SCORE = 40` — "has a source URL" is no
  longer sufficient to keep a finding.

None of this references "Google" anywhere in code — it's driven entirely
by `company.name`/`company.industry`, so the same fix applies to any
company.

Verified by re-running the live pipeline against a fresh "Google" company
on the real deployment (see hackathon.md for the before/after finding
list): before, 6/6 findings were Google's own marketing pages; after, 4
findings from `justice.gov` (DOJ antitrust remedies, score 95), a legal
news source covering a CNIL GDPR fine (score 90), the Financial Times
covering European Commission DMA enforcement (score 85), and one borderline
finding about Google's own ad-certification policy (score 50, right at the
threshold) — the one residual case worth watching, since it's Google's own
platform policy rather than an obligation imposed on Google, but it's
honestly scored low rather than inflated.

## 2026-09-06 — Shifted from "regulatory findings" to a company-profile-driven regulatory ontology

Even after the marketing-page fix, results still read as regulatory
news/enforcement research rather than a genuine regulatory landscape — a
regulation itself (GDPR, the DSA) rarely showed up as its own item; only
enforcement/news mentioning it did. Root cause: the pipeline went straight
from company name to a flat, undifferentiated "finding," with no concept
of company sector/exposure to drive targeted retrieval, and no distinction
between a regime and a development about one.

Redesigned around: `Company → Sector/exposure profile → exposure-driven
retrieval → classification (regime vs. supporting signal) → applicability →
evidence`. Concretely (`convex/schema.ts`, `convex/research.ts`,
`convex/researchActions.ts`, `src/App.tsx`):

- New `companyProfiles` table + a first OpenAI call (Stage 1) that infers
  sector, business model, geographic footprint, and regulatory exposure
  areas from the company name alone (general knowledge, no retrieval — a
  deliberately lightweight exposure map, not corporate intelligence).
- Firecrawl queries (Stage 2) are now built from the profile's own exposure
  areas and jurisdictions instead of one generic "<company> regulatory
  compliance" query — five queries covering regime/law, guidance/
  consultation, enforcement, a second exposure area, and implementation/
  effective-date framing. Nothing is hardcoded per company.
- `findings` gained an ontology (Stage 3 classification): `itemType`
  (REGULATION_REGIME is first-class; GUIDANCE/CONSULTATION/PROPOSED_RULE/
  IMPLEMENTATION/ENFORCEMENT/NEWS/COMPANY_POLICY are supporting signals),
  `regimeKey` (best-effort link from a development back to its regime),
  `status` (in-force vs. future/proposed vs. guidance vs. enforcement —
  an established law facing active enforcement is never marked
  FUTURE_OR_PROPOSED), `applicabilityLevel`/`applicabilityConfidence`
  (core/adjacent/monitor-only + honesty about uncertainty), and
  `sourceQuality` (regulator/government vs. official guidance portal vs.
  secondary reporting). All new `findings` fields are optional at the
  table level (existing pre-ontology test documents stay valid) but
  required by `recordFindings`'s own args validator for every new write.
- The frontend groups the latest run's findings into "Active Regulatory
  Regimes" / "Upcoming or Changing" / "Recent Regulatory Developments"
  instead of one flat list, plus a company-profile card. Only the latest
  run's findings are shown (a watchlist, not an ever-growing dump across
  every past run for a company) — the underlying data still keeps full
  history.
- The `ITEM_TYPES`/`REGULATORY_STATUSES`/`APPLICABILITY_LEVELS`/
  `SOURCE_QUALITY_TIERS` unions live once in `schema.ts` and are imported
  into both the Convex mutation validators and the OpenAI Zod schema, so
  the two can't silently drift apart.

Two real bugs surfaced by running this live against Google, not by
inspection — kept per AGENTS.md §3 (reproduce → evidence → fix):

1. OpenAI's structured-output API rejects Zod `.optional()` fields
   ("uses `.optional()` without `.nullable()` which is not supported") —
   every genuinely-optional field in the classification schema
   (`regimeKey` and the five date fields) had to become `.nullable()`
   instead, with `null` normalized back to `undefined` before writing to
   Convex (whose own `v.optional()` fields expect absence, not `null`).
2. The profiling model returned `confidence: 0.95` despite an explicit
   "0-100" instruction — added a `normalizeConfidence` helper that rescales
   a 0-1 fraction rather than trust prompt wording alone.

Verified with real Firecrawl/OpenAI/Convex calls against Google (EU
exposure) and DBS Bank (Singapore, financial services) — see hackathon.md
for the actual findings. Google now surfaces GDPR, the UK Online Safety
Act, and the EU-US Data Privacy Framework as first-class regimes, with the
CNIL fine correctly demoted to an ENFORCEMENT development tagged
`regime=GDPR`. DBS surfaces MAS Notice 637 (capital adequacy), an HKMA
AML/CTF enforcement action, and Bangladesh banking oversight — a
completely different regulatory domain set than Google's, driven entirely
by the inferred sector/exposure profile rather than any per-company
hardcoding.

## 2026-09-06 — Added jurisdiction selection; it replaces, not filters, retrieval

Added an optional jurisdiction selector (`convex/schema.ts` `JURISDICTIONS`:
Singapore, European Union, United Kingdom, United States, Australia,
India, China — a plain array, so adding one more is a one-line change).
`researchRuns` gained `requestedJurisdiction`; `research.start` and
`researchActions.run` both take an optional `jurisdiction` arg.

The important design choice (per explicit instruction: "do not simply
retrieve global results and filter them afterward") is that when a
jurisdiction is requested, it **replaces** the profile-derived jurisdiction
in every query `buildSearchQueries` builds — regime/law, guidance/
consultation, enforcement, second-exposure-area, and implementation/
effective-date framing are all anchored to it. There's deliberately no
separate "secondary jurisdiction" query when one is requested (auto-detect
still uses the profile's own footprint for a secondary query) — mixing in
the profile's other footprint jurisdictions is exactly the "silently mixed
unrelated jurisdictions" the instruction said to avoid. Company profiling
(Stage 1) stays jurisdiction-agnostic per the given hierarchy diagram
(`Company → sector → exposure profile → SELECTED JURISDICTION → regimes`);
jurisdiction only enters at retrieval and classification. The
classification prompt is told the requested jurisdiction explicitly and
instructed to prioritize it, allow an occasional strongly-evidenced item
from elsewhere without relabeling its jurisdiction field, and not let such
items crowd out the requested one.

Source-quality cleanup: a general (non-company-specific) `isUsableSource`
filter drops noisy/auto-generated-looking source titles (e.g. "592
Research Paper") and non-http(s) URLs before they can ever be cited, and a
`sourceAuthorityRank` sort puts a `.gov`/`.europa.eu`/regulator-domain
source first within a finding's `sources` array so it reads as primary
evidence.

Considered and rejected: automatically downgrading a finding's
`sourceQuality` in code when none of its sources match a domain-authority
pattern. Testing surfaced a real case (the Irish Data Protection
Commission's own site, `dataprotection.ie`) that is genuinely TIER_1 but
matches none of the domain hints (no `.gov`, no "authority" in the name) —
a code-side downgrade would have mislabeled a correct classification while
trying to fix an incorrect one. Fixed the actual root cause instead:
sharpened the `sourceQuality` field's own description with concrete
good/bad examples (a private compliance consultancy site is TIER_3 even
when it accurately describes a real regulation). This measurably improved
citations in the same test run (BIS.org and mas.gov.sg used correctly
where a prior run hadn't), though one vendor-site case
(`arctic-intelligence.com`) still gets mislabeled TIER_1 sometimes — see
demo-script.md / the final report for this pass; logged as a known
weakness rather than chased further, per "do one focused cleanup."

Verified live: ByteDance + European Union produced 5/5 EU-scoped findings
(DSA and GDPR as TIER_1 REGULATION_REGIME items from `ec.europa.eu` and
`dataprotection.ie`, the real €530M Irish DPC GDPR fine as a supporting
ENFORCEMENT item tagged `regime=GDPR`) with no US/China/India footprint
noise despite the profile listing those jurisdictions. DBS Bank +
Singapore produced an MAS AML/CFT enforcement action naming DBS
specifically, the Payment Services Act, and Basel III implementation, all
Singapore-scoped. Stripe with Global/Auto-detect reproduced the
pre-existing multi-jurisdiction discovery behavior (US/EU/UK spread)
unchanged, confirming auto-detect wasn't regressed.

## 2026-09-06 — Applicability evidence guardrail: prompt alone was insufficient, added a code-side caveat backstop

User feedback on a real ByteDance + European Union run: the DMA finding
stated "ByteDance, designated as a gatekeeper with respect to TikTok in the
EU…" as settled fact, sourced only from a private compliance-vendor blog —
a material regulatory designation asserted from general LLM knowledge
rather than the retrieved evidence.

First fix (prompt-only, per the given requirements): added a new
`applicabilityEvidence` axis (`DIRECTLY_EVIDENCED` / `STRONGLY_INFERRED` /
`POSSIBLE_UNCERTAIN`) to `schema.ts` (`APPLICABILITY_EVIDENCE_LEVELS`,
`applicabilityEvidenceValidator`), threaded through `research.ts`'s
`recordFindings` validator (required for every new write, optional at the
table level for backward compatibility) and the OpenAI Zod schema in
`researchActions.ts`, with a detailed field description distinguishing "a
source explicitly names this company's specific status/designation" from
"follows from the general business model" from "speculative/thin." Also
sharpened `summary`/`whyItMatters` field descriptions and the classification
system prompt to require hedged wording ("may be considered…", "is
potentially subject to…") whenever `applicabilityEvidence` isn't
`DIRECTLY_EVIDENCED`. This is orthogonal to `applicabilityLevel` (how
central the exposure is) — a regime can be `CORE_EXPOSURE` while the
specific designation claim about it is only inferred. `applicabilityLevel`
itself was left unchanged per the instruction to keep the ontology's
architecture intact.

Live re-test (real ByteDance + European Union run) proved this
insufficient: the model correctly self-tagged the DMA finding as
`applicabilityEvidence=STRONGLY_INFERRED`, but its own `summary` and
`whyItMatters` prose still asserted the gatekeeper designation as unhedged
fact — confirming the exact user-reported bug persisted even after the
schema/prompt fix. The structured field and the free text can disagree.

Fix: rather than try to rewrite the model's sentence (real risk of mangling
a true claim into a false one, or vice versa), added a code-side backstop
in `researchActions.ts` — `containsUnhedgedDesignationClaim()` (a general,
non-company-specific regex over designation-claim terms like "gatekeeper",
"VLOP", "VLOSE", "designated as", "licensed", "fined", crossed against
common hedge words) and `withEvidenceCaveatIfNeeded()`, which prepends an
honest, always-true caveat ("the retrieved sources don't explicitly confirm
this specific designation/status for this company — treat it as a
plausible inference, not a confirmed fact") whenever `applicabilityEvidence
!== "DIRECTLY_EVIDENCED"` and the text contains an unhedged designation
claim. Applied independently to both `summary` and `whyItMatters` (an
earlier pass only covered `whyItMatters`; the retest showed `summary` still
carried the same unhedged claim, since the UI renders both fields directly
to the user). Nothing here references ByteDance, TikTok, DMA, DSA, or GDPR
by name — the term list and logic are general enough to apply to any
company/regime combination, matching the explicit "do not hardcode"
requirement. A `caveatedCount` diagnostic log line reports how often this
backstop actually fires per run, for future spot-checking.

Verified live (ByteDance + European Union, after the full fix): DSA and
GDPR findings state applicability in general, non-designation terms
("large online platform subject to DSA obligations", "processes personal
data of EU residents") and were left uncaveated — appropriate, since
neither asserts a specific status this company was never confirmed to
hold. The two enforcement-based GDPR findings (the Irish DPC's real €530M
fine and its follow-up investigation, both sourced from
`dataprotection.ie`) came back `DIRECTLY_EVIDENCED` and uncaveated,
correctly. The DMA finding's `summary` and `whyItMatters` both now open
with the evidence caveat rather than asserting the gatekeeper designation
as fact, while `applicabilityEvidence=STRONGLY_INFERRED` explains why. The
run still returned 8 useful findings overall (DMA, DSA, GDPR ×3, an EU
consumer-protection complaint, the strengthened Disinformation Code of
Practice, a GDPR procedural-regulation proposal) — the guardrail added
honesty, it didn't delete uncertain-but-useful results.

## 2026-09-06 — Final targeted quality pass: hard jurisdiction scope, real claim rewriting, source demotion

User review of three real outputs (Google+Singapore, TikTok+Singapore,
ByteDance+EU) found the architecture strong but flagged four remaining
issues before freezing the regulatory core. All four fixed in
`convex/researchActions.ts` / `src/App.tsx`, no schema or architecture
changes:

1. **Explicit jurisdiction wasn't a hard scope.** An EU DMA item could
   still surface in a Singapore run's "Recent Regulatory Developments"
   because the classification prompt only asked the model to deprioritize
   (not exclude) out-of-jurisdiction items. Added `jurisdictionMatchesRequested`
   — a code-side filter, same backstop pattern as the evidence guardrail —
   that drops any finding whose jurisdiction doesn't match the requested
   one before it's ever persisted, with a small alias table (`EU`/`UK`/`US`
   shorthand) and word-boundary matching (so a short alias like `"us"`
   can't false-match inside an unrelated word like "Mauritius"). A
   genuinely global/international item still passes through — it does
   apply within the requested jurisdiction too, so dropping it would be
   over-correction. The classification prompt's old "allow an occasional
   strongly-evidenced item from elsewhere" carve-out (added in the previous
   jurisdiction-selection pass) is removed; this was the actual source of
   the leak, and the earlier pass didn't yet have a code-side backstop for
   it.

2. **"Caveat but still assert the claim."** The previous pass's
   `withEvidenceCaveatIfNeeded` only prepended a disclaimer sentence before
   the model's own unhedged prose — the DMA finding still read "...the
   sources don't confirm this... ByteDance has been designated as a
   gatekeeper..." in the same breath. Replaced it with
   `neutralizeUnsupportedClaims`: split the text into sentences, and for
   any sentence that asserts an unhedged designation/status claim
   (gatekeeper, VLOP/VLOSE, licence, registration, designation, fine/
   penalty, regulated-entity status, enforcement outcome — a categorized
   term list, still no company/regulation-specific hardcoding), replace
   the *sentence itself* with a generic hedge built from the finding's own
   `regimeKey`/`title` and `regulatoryArea` (e.g. "DMA may be relevant to
   this company's competition & antitrust activities, but the retrieved
   authoritative sources do not confirm a specific gatekeeper designation
   for this company or service."), dropping any further offending sentence
   in the same field rather than repeating the hedge. `DIRECTLY_EVIDENCED`
   text is left untouched, and text that's already hedged in the model's
   own words is left untouched too (the detector requires the absence of a
   hedge word in the same sentence).

3. **Stale jurisdiction selector.** `CompanyPicker`'s jurisdiction dropdown
   wasn't reset after a successful submission (only name/industry were),
   so it could show a previous company's jurisdiction while viewing a
   different company's historical run — confusing, though the displayed
   "Jurisdiction:" line was already reading `latestRun.requestedJurisdiction`
   (verified, unchanged) rather than form state. Added `setJurisdiction(AUTO_DETECT)`
   alongside the existing resets.

4. **Source quality.** `sourceAuthorityRank` (from the previous jurisdiction
   pass) only ever promoted a recognized regulator-domain pattern, leaving
   Wikipedia, compliance-vendor blogs, and a company's own domain all in
   the same "neutral" middle tier as an unrecognized-but-legitimate
   regulator like `dataprotection.ie` — so a finding could cite
   `cloud.google.com` and three cookie-consent-vendor blog posts with none
   demoted relative to each other. Added a third, demoted tier: a narrow
   hostname/URL-pattern match for known generic sources (Wikipedia, Medium,
   Investopedia, and — found live during this pass — a `/blog/`-style URL
   path, which caught two real vendor sources `cookieyes.com/blog/...` and
   `pandectes.io/blog/...` that a hostname-only "blog" check had missed),
   plus a company's-own-domain check (`isCompanyOwnDomain`, driven by
   `company.name` each run, e.g. "Google" → `cloud.google.com` — not a
   hardcoded domain list, and checked against the hostname only so a
   regulator URL merely mentioning the company in its path, e.g.
   `dataprotection.ie/.../fines-tiktok`, is never caught by it).
   Deliberately asymmetric per the explicit instruction not to add a
   heuristic that could downgrade a legitimate regulator: this only ever
   *demotes* a narrow, recognizable low-quality pattern, never guesses at
   *promoting* an unfamiliar domain.

Verified live (Firecrawl credits were briefly exhausted mid-pass — see
below — then topped up):

- **Google + Singapore** (re-run twice, once before and once after the
  source-ranking fix): every finding's `jurisdiction` is `Singapore`; no
  EU/DMA item leaked into the landscape. Before the fix, the PDPA regime
  finding's sources were `cloud.google.com`, `cookieyes.com/blog/...`,
  `cookie-script.com/...`, `pandectes.io/blog/...` — none demoted relative
  to each other. After: `cloud.google.com` and both `/blog/` vendor URLs
  correctly demoted to the back, `cookie-script.com` (no detectable
  low-quality pattern — a known residual gap, see below) sorted ahead of
  them.
- **ByteDance + European Union**: DMA (`STRONGLY_INFERRED`, sole source a
  law-firm blog) now reads only the generic hedge sentence in both
  `summary` and `whyItMatters` — no "has been designated as a gatekeeper"
  anywhere. DSA and the three GDPR findings (two `DIRECTLY_EVIDENCED`
  enforcement items citing the real €530M Irish DPC fine, one
  `STRONGLY_INFERRED` general-regime item) remained useful and
  appropriately supported; the DSA finding's own VLOP/VLOSE sentence was
  hedged the same way DMA's was, while its non-designation sentences
  (which don't assert a specific status) were left as the model wrote
  them.
- **Stripe, Global/Auto-detect**: 8 findings spanning Global (sanctions),
  United States (FTC, FinCEN/BSA), European Union (PSR, PSD3, AML
  package), and United Kingdom (Payment Services Regulations) — confirms
  the jurisdiction hard-scope filter is a no-op when no jurisdiction is
  requested, and multi-jurisdiction auto-detect discovery is unchanged
  from the previous pass.

Also hit and resolved mid-pass: the Firecrawl API key on this deployment
returned "Insufficient credits to perform this request" on a real run,
and the same error persisted even after temporarily lowering the
per-query result `limit` from 4 to 2 — confirming a real exhausted balance
rather than a per-call cap, so the `limit` change was reverted rather than
kept as a workaround. Verified the new pure logic (jurisdiction matching,
claim rewriting, source ranking) directly against the real captured
ByteDance/DMA text and a `dataprotection.ie` non-regression case via a
standalone script while waiting for credits to be topped up, then re-ran
all three live tests above once credits were restored.

Known residual gap, not chased further per "final targeted pass, don't
redesign": a generic compliance-vendor domain with no `/blog/`-style URL
path and no name match to the company (e.g. `cookie-script.com`) isn't
demoted — there's no non-hardcoded, low-false-positive way to recognize it
as a vendor from the URL alone. It stays in the neutral middle tier rather
than the back, same as an unrecognized real regulator would.

## Open questions (not yet decided)

- Exact Firecrawl call shape (search vs. targeted crawl of known regulator
  domains) — to be settled once Firecrawl's API is inspected directly
  rather than assumed (AGENTS.md §1: prefer official docs over assumptions).
- Exact OpenAI extraction schema/model — to be pinned once implemented and
  tested against real crawled content.
