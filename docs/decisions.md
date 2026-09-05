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

## 2026-09-05 — Use generated `env` from `convex/_generated/server`, not bare `process.env`

Node actions (`researchActions.ts`, `notify.ts`) read `FIRECRAWL_API_KEY`,
`OPENAI_API_KEY`, and `AGENTMAIL_API_KEY`/`AGENTMAIL_INBOX_ID` via the `env`
object Convex's own codegen exports from `_generated/server.ts`, instead of
the bare `process` global. This avoids requiring `@types/node` in a project
that also typechecks `convex/*.ts` from the frontend's Vite project (whose
`tsconfig.app.json` has no Node lib/types) — the frontend imports
`../convex/_generated/api`, which pulls in every `convex/*.ts` file
type-only, so both projects must be able to check the same files without
Node ambient globals. This is also just the pattern Convex's generated code
itself uses.

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

## Open questions (not yet decided)

- Exact Firecrawl call shape (search vs. targeted crawl of known regulator
  domains) — to be settled once Firecrawl's API is inspected directly
  rather than assumed (AGENTS.md §1: prefer official docs over assumptions).
- Exact OpenAI extraction schema/model — to be pinned once implemented and
  tested against real crawled content.
