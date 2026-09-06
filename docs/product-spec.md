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

RegVista's core question: *what regulatory regimes, obligations,
consultations, proposed changes, guidance, and enforcement developments
should this company be watching?*

1. User enters a company (name + optional industry hint) and optionally
   selects a **jurisdiction** to scope the research to (Global / Auto-detect,
   or one of a starter list — Singapore, EU, UK, US, Australia, India,
   China — easy to extend without restructuring anything).
2. RegVista infers a lightweight **company profile** (sector, business
   model, geographic footprint, regulatory exposure areas) via OpenAI —
   a useful exposure map, not a full corporate-intelligence dossier. This
   step is jurisdiction-agnostic; jurisdiction only enters from here on.
3. RegVista researches the company's regulatory landscape using Firecrawl
   (retrieval driven by the inferred exposure areas, and by the selected
   jurisdiction when one was requested — replacing the auto-detected
   jurisdiction for every query rather than being filtered in afterward)
   and OpenAI (structured extraction/classification, told the requested
   jurisdiction explicitly so it prioritizes findings scoped to it).
4. RegVista shows the company's regulatory landscape as a hierarchy, not a
   flat list of findings:
   - **Company profile**: sector, business model, exposure areas, confidence.
   - **Active Regulatory Regimes**: established regulations/frameworks that
     are first-class landscape items (e.g. GDPR, the UK Online Safety Act,
     MAS banking notices) — not enforcement news about them.
   - **Upcoming / Changing**: proposed rules, consultations, and regimes not
     yet in force.
   - **Recent Regulatory Developments**: enforcement actions, investigations,
     guidance, and company disclosures — supporting signals, ideally tied
     back to the regime they relate to, not the primary output.
   - Every item carries **evidence/sources**, a **relevance score**,
     **applicability** (core/adjacent/monitor-only + confidence), and a
     **"why this matters"** explanation specific to the company.
5. User can request an emailed briefing of the current landscape, sent via
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
- **CompanyProfile**: belongs to a company + the run that produced it; sector,
  business model, geographic footprint, regulatory exposure areas, and a
  confidence score. Refreshed each research run.
- **Finding**: belongs to a research run + company. Beyond jurisdiction/
  regulator/regulatory area/title/summary/relevance score/"why this
  matters"/sources, each finding is classified by:
  - **itemType** — REGULATION_REGIME is first-class; GUIDANCE/CONSULTATION/
    PROPOSED_RULE/IMPLEMENTATION/ENFORCEMENT/NEWS/COMPANY_POLICY are
    supporting signals (generic compliance marketing is classified and
    dropped, never persisted).
  - **regimeKey** — best-effort link from a supporting item back to the
    regime it relates to (e.g. an enforcement action tagged "GDPR").
  - **status** — whether an established regime currently has active
    obligations, is future/proposed, or the item is guidance/enforcement.
  - **applicabilityLevel** + **applicabilityConfidence** — core/adjacent/
    monitor-only, and how confident the model is that this genuinely
    applies to this company.
  - **sourceQuality** — regulator/government vs. official guidance portal
    vs. secondary reporting.
  - Optional free-text dates (publication/effective/implementation/
    consultation deadline/reporting deadline) — never fabricated precise
    dates when the source doesn't give one.

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
