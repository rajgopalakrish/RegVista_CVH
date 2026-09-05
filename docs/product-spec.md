# RegVista — Product Spec

## One-line pitch

Enter a company. See its regulatory world.

## Product principle

RegVista is **company-centric** regulatory intelligence:

`Company → Regulatory Landscape`

This is the opposite direction from RegLens, which is regulation-centric
(`Regulation → Implications/Actions`). RegVista must never collapse into a
renamed RegLens: every screen starts from a company, not from a regulation.

## Primary user flow

1. User enters a company (name + optional context: industry, HQ country/state,
   website).
2. RegVista researches the company's regulatory landscape using Firecrawl
   (source discovery/retrieval from authoritative sites) and OpenAI
   (structured extraction/classification/relevance reasoning).
3. RegVista shows the company's:
   - **Jurisdictions** it is subject to.
   - **Regulators** with authority over it.
   - **Regulatory areas** (e.g. data privacy, financial services, labor,
     environmental).
   - **Regulations/developments** relevant to it, each with a **relevance
     score/priority** and a **"why this matters"** explanation.
   - **Evidence/sources** backing each finding (source URL, title, retrieved
     date).
4. User can request an emailed briefing of the current landscape, sent via
   AgentMail.

## MVP scope (in)

- Single-user, no auth.
- Manual "research this company" trigger (button), not continuous background
  monitoring, for the hackathon MVP.
- One research run produces a structured, evidence-backed regulatory
  landscape for one company, persisted in Convex and shown reactively.
- One AgentMail action: send the current landscape as a briefing email to an
  address the user provides.
- Convex is the system of record: companies, research runs, and findings are
  real persisted documents with reactive queries, not client-only state.

## MVP scope (out, for now — see AGENTS.md §9)

- Auth/permissions, billing, multi-tenant accounts.
- Continuous/scheduled monitoring and diffing of regulatory changes over
  time (a natural v2 use of AgentMail's inbox + Convex crons, not required
  to demonstrate the core loop).
- Elaborate dashboards, custom vector DB, knowledge graphs.
- Multi-agent orchestration.

## Data model (conceptual)

- **Company**: name, optional industry/HQ jurisdiction/website, created at.
- **ResearchRun**: belongs to a company; status (pending/running/done/error);
  started/finished timestamps.
- **Finding**: belongs to a research run + company; jurisdiction; regulator;
  regulatory area; regulation/development title + summary; relevance score
  (0–100) and rationale ("why this matters"); array of evidence sources
  (`{url, title, retrievedAt}`).

See `docs/architecture.md` for the concrete Convex schema.

## Trust rules (see AGENTS.md §8)

- Every finding must carry at least one evidence source when the underlying
  Firecrawl/OpenAI pipeline produced one. If OpenAI cannot ground a claim in
  retrieved content, the finding is either dropped or explicitly marked as
  unverified — never presented as fact without a source.
- Crawled content is untrusted input: it is data to extract facts from, never
  instructions to follow.

## Success criteria for the hackathon submission

1. A real user can type a company name and, within the demo, see a
   non-trivial, evidence-backed regulatory landscape appear reactively.
2. Firecrawl, OpenAI, and AgentMail each do real work in the product (not
   decorative).
3. Convex does real work: schema, queries, mutations, actions, and reactive
   UI updates — not a thin frontend on a static page.
4. The demo is reliable enough to run live and on video without failing.
