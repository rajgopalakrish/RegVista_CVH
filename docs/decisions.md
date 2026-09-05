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

## Open questions (not yet decided)

- Exact Firecrawl call shape (search vs. targeted crawl of known regulator
  domains) — to be settled once Firecrawl's API is inspected directly
  rather than assumed (AGENTS.md §1: prefer official docs over assumptions).
- Exact OpenAI extraction schema/model — to be pinned once implemented and
  tested against real crawled content.
