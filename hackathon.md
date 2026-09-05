# Hackathon log

- **Project:** RegVista
- **Event:** Convex All Gas Hackathon
- **What it does:** Enter a company and see its regulatory landscape —
  jurisdictions, regulators, regulatory areas, and evidence-backed findings
  with a relevance score and "why this matters," plus an emailed briefing.
- **Live app:** https://brilliant-roadrunner-68.convex.site
- **Repo:** https://github.com/rajgopalakrish/RegVista_CVH
- **Frontend:** Convex static hosting
- **Convex deployment:** https://brilliant-roadrunner-68.convex.cloud
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, indexes, queries, mutations, internal mutations, actions, internal actions, scheduled functions, realtime queries
- **Auth:** none
- **AI models:** gpt-4.1-mini (direct OpenAI SDK call, not the Convex AI Gateway)
- **Started:** 2026-09-05T07:16:49Z
- **Last updated:** 2026-09-05T17:05:20Z

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
