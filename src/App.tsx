import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { JURISDICTIONS } from "../convex/schema";
import type { Doc, Id } from "../convex/_generated/dataModel";

const AUTO_DETECT = "";

// Purely decorative — an abstract node/line motif evoking the shape of
// regulatory intelligence (a company fanning out to regulatory areas, and
// each area fanning out further to the regimes/regulators/jurisdictions
// beneath it). Coordinates are hand-placed constants, not derived from any
// company's actual data — no labels, no real names, nothing here should
// ever be read as representing a researched relationship.
// Spread across nearly the full 0–900 viewBox width (previously clustered
// in the left ~90%, leaving visible dead space at the header's right edge
// once "slice" scaling maps the viewBox onto the full-width header).
const HERO_ROOT: readonly [number, number] = [40, 112];
const HERO_AREA_NODES: readonly (readonly [number, number])[] = [
  [150, 44],
  [330, 24],
  [540, 62],
  [720, 30],
  [860, 76],
  [600, 150],
  [300, 168],
];
// [x, y, index into HERO_AREA_NODES this leaf branches from]
const HERO_LEAF_NODES: readonly (readonly [number, number, number])[] = [
  [205, 96, 0],
  [110, 88, 0],
  [380, 68, 1],
  [410, 8, 1],
  [595, 108, 2],
  [515, 28, 2],
  [790, 78, 3],
  [770, 8, 3],
  [840, 38, 4],
  [875, 118, 4],
  [665, 188, 5],
  [520, 168, 5],
  [220, 198, 6],
  [390, 188, 6],
];

function HeroMotif() {
  return (
    <div className="hero-motif" aria-hidden="true">
      <svg className="hero-motif-svg" viewBox="0 0 900 220" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="hero-motif-lines">
          {HERO_AREA_NODES.map(([x, y], i) => (
            <line key={`root-${i}`} x1={HERO_ROOT[0]} y1={HERO_ROOT[1]} x2={x} y2={y} />
          ))}
          {HERO_LEAF_NODES.map(([x, y, parent], i) => {
            const [px, py] = HERO_AREA_NODES[parent];
            return <line key={`leaf-${i}`} x1={px} y1={py} x2={x} y2={y} />;
          })}
        </g>
        <g className="hero-motif-nodes">
          <circle className="hero-motif-node hero-motif-node-root" cx={HERO_ROOT[0]} cy={HERO_ROOT[1]} r={5} />
          {HERO_AREA_NODES.map(([x, y], i) => (
            <circle key={`area-${i}`} className="hero-motif-node hero-motif-node-area" cx={x} cy={y} r={3.2} />
          ))}
          {HERO_LEAF_NODES.map(([x, y], i) => (
            <circle key={`leafnode-${i}`} className="hero-motif-node hero-motif-node-leaf" cx={x} cy={y} r={1.8} />
          ))}
        </g>
      </svg>
    </div>
  );
}

export default function App() {
  const [companyId, setCompanyId] = useState<Id<"companies"> | null>(null);

  return (
    <div className="app">
      <header className="app-header">
        <HeroMotif />
        <div className="brand">
          <h1>RegVista</h1>
          <span className="brand-badge">Regulatory Intelligence</span>
        </div>
        <p className="tagline">Enter a company. See its regulatory world.</p>
      </header>

      <CompanyPicker selectedId={companyId} onSelect={setCompanyId} />

      {companyId && <RegulatoryLandscape companyId={companyId} />}
    </div>
  );
}

function CompanyPicker({
  selectedId,
  onSelect,
}: {
  selectedId: Id<"companies"> | null;
  onSelect: (id: Id<"companies">) => void;
}) {
  const createCompany = useMutation(api.companies.create);
  const startResearch = useMutation(api.research.start);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [jurisdiction, setJurisdiction] = useState(AUTO_DETECT);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const newCompanyId = await createCompany({
        name: name.trim(),
        industry: industry.trim() || undefined,
      });
      onSelect(newCompanyId);
      await startResearch({
        companyId: newCompanyId,
        jurisdiction:
          jurisdiction === AUTO_DETECT
            ? undefined
            : (jurisdiction as (typeof JURISDICTIONS)[number]),
      });
      setName("");
      setIndustry("");
      // Reset the selector too, not just name/industry — leaving a previous
      // company's jurisdiction selected here reads as if it still applies
      // to whichever company is now being viewed, even though the actual
      // displayed result always uses that run's own requestedJurisdiction
      // (see the "Jurisdiction:" line below), never this form's state.
      setJurisdiction(AUTO_DETECT);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="company-picker">
      <p className="section-label">Research a company</p>
      <form onSubmit={handleSubmit} className="research-form">
        <div className="research-form-primary">
          <label className="field">
            <span className="field-label">Company</span>
            <input
              className="company-name-input"
              placeholder="e.g. Stripe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field field-jurisdiction">
            <span className="field-label">Jurisdiction</span>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              aria-label="Jurisdiction"
            >
              <option value={AUTO_DETECT}>Global / Auto-detect</option>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Starting research…" : "Research"}
          </button>
        </div>
        <label className="field field-industry">
          <span className="field-label">Industry (optional)</span>
          <input
            placeholder="Helps sharpen the sector profile"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
        </label>
      </form>

      <RecentList selectedId={selectedId} onSelect={onSelect} />
    </section>
  );
}

const RUN_STATUS_LABELS: Record<string, string> = {
  pending: "queued",
  running: "researching…",
  done: "done",
  error: "error",
};

function formatRelativeTime(at: number): string {
  const diffMs = Date.now() - at;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function RecentList({
  selectedId,
  onSelect,
}: {
  selectedId: Id<"companies"> | null;
  onSelect: (id: Id<"companies">) => void;
}) {
  const recent = useQuery(api.research.recentCompanies);
  if (!recent || recent.length === 0) return null;

  return (
    <div className="recent-list">
      <span className="section-label">Recent</span>
      <ul>
        {recent.map((r) => (
          <li key={r.companyId}>
            <button
              className={
                r.companyId === selectedId ? "recent-row recent-row-active" : "recent-row"
              }
              onClick={() => onSelect(r.companyId)}
            >
              <span className={`status-dot status-dot-${r.status ?? "pending"}`} />
              <span className="recent-row-name">{r.name}</span>
              <span className="recent-row-meta">
                {r.requestedJurisdiction ?? "Global"}
                {r.status && <> · {RUN_STATUS_LABELS[r.status] ?? r.status}</>}
                {" · "}
                {formatRelativeTime(r.at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Finding = Doc<"findings">;

// Subtle brand identity for the specific companies used in demos — a
// colored wordmark chip built from the company's own name and brand color,
// not traced logo artwork (no external asset fetch, no added dependency).
// Matched by substring against the company's stored name (e.g. "Grab
// Holdings" still matches "grab"), so it's additive and silent for any
// other company: CompanyBadge renders nothing unless a name matches one of
// these entries — never add one for a company not actually being
// demonstrated.
type CompanyBrand = { test: (name: string) => boolean; label: string; className: string };
const COMPANY_BRANDS: CompanyBrand[] = [
  { test: (n) => n.toLowerCase().includes("grab"), label: "Grab", className: "brand-chip-grab" },
  { test: (n) => n.toLowerCase().includes("dbs"), label: "DBS", className: "brand-chip-dbs" },
  { test: (n) => n.toLowerCase().includes("google"), label: "Google", className: "brand-chip-google" },
  { test: (n) => n.toLowerCase().includes("stripe"), label: "Stripe", className: "brand-chip-stripe" },
];

function CompanyBadge({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  const brand = COMPANY_BRANDS.find((b) => b.test(name));
  if (!brand) return null;
  return (
    <span className={`brand-chip ${brand.className} brand-chip-${size}`}>
      {brand.className === "brand-chip-google" && (
        <span className="brand-chip-dots" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {brand.label}
    </span>
  );
}

function JurisdictionIcon() {
  return (
    <svg className="chip-icon" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
      <path
        d="M8 1c-2.76 0-5 2.24-5 5 0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5Zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Shown on a regime chip only when that finding's sourceQuality is
// TIER_1_REGULATOR_GOVERNMENT — reusing a field already computed by the
// research engine, not a new judgment made here.
function ProvenanceTick() {
  return (
    <svg className="chip-icon chip-icon-verified" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
      <path
        d="M8 1 2.5 3v4.2C2.5 10.9 4.8 14 8 15c3.2-1 5.5-4.1 5.5-7.8V3L8 1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5.5 8.2 7.2 10l3.3-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// An item without itemType is pre-ontology test data (from before this
// field set existed) — shown in "Recent Developments" as a fallback so
// nothing silently disappears, rather than assuming a bucket for it.
//
// "Active Regulatory Regimes" is driven by the ledger's stable
// activeRegimeExposures, not this function. This function instead now
// identifies a current-run REGULATION_REGIME item with established status
// that the ledger didn't (yet) admit — e.g. a secondary source or
// POSSIBLE_UNCERTAIN evidence — so it can be shown as a distinct "Potential
// / Unconfirmed Regulatory Signal" rather than either being promoted into
// the ledger's group or silently dropped/mislabeled as a generic
// development.
function isEstablishedRegime(f: Finding) {
  return (
    f.itemType === "REGULATION_REGIME" &&
    (f.status === "PASSED_NO_ACTIVE_OBLIGATIONS" ||
      f.status === "PASSED_PENDING_OR_ONGOING_OBLIGATIONS")
  );
}

function isUpcomingOrChanging(f: Finding) {
  return (
    (f.itemType === "REGULATION_REGIME" && f.status === "FUTURE_OR_PROPOSED") ||
    f.itemType === "CONSULTATION" ||
    f.itemType === "PROPOSED_RULE" ||
    f.itemType === "IMPLEMENTATION"
  );
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  REGULATION_REGIME: "Regulation / Regime",
  GUIDANCE: "Guidance",
  CONSULTATION: "Consultation",
  PROPOSED_RULE: "Proposed rule",
  IMPLEMENTATION: "Implementation",
  ENFORCEMENT: "Enforcement",
  NEWS: "News",
  COMPANY_POLICY: "Company disclosure",
};

const STATUS_LABELS: Record<string, string> = {
  PASSED_NO_ACTIVE_OBLIGATIONS: "In force",
  PASSED_PENDING_OR_ONGOING_OBLIGATIONS: "In force — active obligations",
  FUTURE_OR_PROPOSED: "Future / proposed",
  GUIDANCE_INTERPRETATION: "Guidance",
  ENFORCEMENT_DEVELOPMENT: "Enforcement",
};

const APPLICABILITY_LABELS: Record<string, string> = {
  CORE_EXPOSURE: "Core exposure",
  ADJACENT_EXPOSURE: "Adjacent exposure",
  MONITOR_ONLY: "Monitor only",
};

// How well-evidenced the specific applicability claim is — distinct from
// applicabilityLevel (how central the exposure is).
const APPLICABILITY_EVIDENCE_LABELS: Record<string, string> = {
  DIRECTLY_EVIDENCED: "Directly evidenced",
  STRONGLY_INFERRED: "Strongly inferred",
  POSSIBLE_UNCERTAIN: "Possible / uncertain",
};

const EVIDENCE_DOT_CLASS: Record<string, string> = {
  DIRECTLY_EVIDENCED: "evidence-dot-high",
  STRONGLY_INFERRED: "evidence-dot-medium",
  POSSIBLE_UNCERTAIN: "evidence-dot-low",
};

const SOURCE_QUALITY_LABELS: Record<string, string> = {
  TIER_1_REGULATOR_GOVERNMENT: "Regulator / government source",
  TIER_2_OFFICIAL_GUIDANCE_CONSULTATION: "Official guidance",
  TIER_3_SECONDARY_REPORTING: "Secondary reporting",
};

// Presentation-only consistency pass: the underlying research engine
// already sets applicabilityEvidence honestly and (per its own guardrail)
// avoids stating a specific designation/license/fine as fact when evidence
// isn't DIRECTLY_EVIDENCED — but that guardrail targets specific status
// claims, not general definitive-applicability phrasing like "falls under"
// or "must comply with". This softens exactly that narrow, named set of
// phrases at render time — never touching the stored summary/whyItMatters,
// never touching applicabilityLevel/applicabilityEvidence themselves, and
// leaving DIRECTLY_EVIDENCED findings (and any sentence that's already
// hedged) completely untouched.
const HEDGE_WORDS_RE =
  /\b(may|might|could|possibly|potentially|likely|appears? to|is believed|reportedly|is thought|plausibly)\b/i;

// "subject to" gets its own pass, separate from the phrase map below: it
// can follow many different verbs, optionally with an adverb in between
// ("is subject to", "is directly subject to", "will be subject to", or
// no verb at all — "a bank subject to X"). Naively replacing only the
// two-word "subject to" fragment while leaving a preceding verb untouched
// produces a double modal ("will be may be subject to", "is directly may
// be subject to"). Fixed as two steps instead: (1) delete a verb that
// precedes "subject to" within a few words, via a zero-width lookahead so
// nothing in between (like "directly") is consumed or lost; (2) insert
// "may be" in front of whatever "subject to" remains, covering both the
// just-stripped-verb case and the bare adjectival case uniformly.
const SUBJECT_TO_TEST_RE = /\bsubject to\b/i;
const SUBJECT_TO_VERB_RE =
  /\b(?:is|are|was|were|will\s+be|would\s+be|shall\s+be|remains?|becomes?)\b(?=(?:\s+\S+){0,3}\s+subject to\b)/gi;
const BARE_SUBJECT_TO_RE = /\bsubject to\b/gi;

function softenSubjectTo(sentence: string): string {
  const withoutVerb = sentence.replace(SUBJECT_TO_VERB_RE, "");
  const withHedge = withoutVerb.replace(BARE_SUBJECT_TO_RE, "may be subject to");
  return withHedge.replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

// Phrase -> hedged replacement. Built into ONE combined regex (rather than
// applying each pattern in sequence) so a single scan replaces every match
// exactly once — sequential per-pattern replacement risks a phrase like
// "fall under" re-matching inside the "may fall under" text just inserted
// by the "falls under" pattern, producing "may may fall under".
//
// Widened from an initial version scoped only to "must comply with" after
// inspecting real rendered findings: STRONGLY_INFERRED/POSSIBLE_UNCERTAIN
// findings also used "must apply"/"must implement" (not just "comply
// with"), the gerund "falling under", and "is obligated" — none caught by
// the narrower phrase list. A bare "must" -> "may need to" catches every
// "must <verb>" construction generically rather than enumerating each one.
const APPLICABILITY_PHRASE_MAP: Record<string, string> = {
  "falls under": "may fall under",
  "fall under": "may fall under",
  "falling under": "potentially falling under",
  "fell under": "may have fallen under",
  must: "may need to",
  "is required to": "may be required to",
  "are required to": "may be required to",
  "is obligated": "may be obligated",
  "are obligated": "may be obligated",
  "is governed by": "may be governed by",
  "are governed by": "may be governed by",
  "is bound by": "may be bound by",
  "are bound by": "may be bound by",
  "is regulated by": "may be regulated by",
  "are regulated by": "may be regulated by",
};
const APPLICABILITY_PHRASE_PATTERN = Object.keys(APPLICABILITY_PHRASE_MAP)
  .sort((a, b) => b.length - a.length)
  .join("|");
const DEFINITIVE_APPLICABILITY_RE = new RegExp(`\\b(${APPLICABILITY_PHRASE_PATTERN})\\b`, "i");
const DEFINITIVE_APPLICABILITY_REPLACE_RE = new RegExp(`\\b(${APPLICABILITY_PHRASE_PATTERN})\\b`, "gi");

function presentApplicabilityText(text: string, evidence: string | undefined): string {
  if (!evidence || evidence === "DIRECTLY_EVIDENCED") return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const softened = sentences.map((sentence) => {
    // Already hedged (by the model itself, or by the engine's own
    // designation-claim guardrail) — leave it exactly as written.
    if (HEDGE_WORDS_RE.test(sentence)) return sentence;
    const needsSubjectTo = SUBJECT_TO_TEST_RE.test(sentence);
    const needsPhraseSwap = DEFINITIVE_APPLICABILITY_RE.test(sentence);
    if (!needsSubjectTo && !needsPhraseSwap) return sentence;
    let result = sentence;
    if (needsSubjectTo) {
      result = softenSubjectTo(result);
    }
    if (needsPhraseSwap) {
      result = result.replace(
        DEFINITIVE_APPLICABILITY_REPLACE_RE,
        (match) => APPLICABILITY_PHRASE_MAP[match.toLowerCase()] ?? match,
      );
    }
    return result;
  });
  return softened.join(" ");
}

function RegulatoryLandscape({ companyId }: { companyId: Id<"companies"> }) {
  const company = useQuery(api.companies.get, { companyId });
  const landscape = useQuery(api.research.listByCompany, { companyId });
  const sendBriefing = useAction(api.notify.sendBriefing);

  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [highlightedId, setHighlightedId] = useState<Id<"findings"> | null>(null);

  if (!company || !landscape) {
    return (
      <section className="landscape">
        <div className="loading-state">
          <span className="loading-spinner" aria-hidden="true" />
          <p>Loading regulatory landscape…</p>
        </div>
      </section>
    );
  }

  const { latestRun, findings, profile, activeRegimeExposures } = landscape;
  // Only the latest run's findings — a watchlist, not an ever-growing dump
  // of every research run this company has ever had.
  const currentFindings = latestRun
    ? findings.filter((f) => f.researchRunId === latestRun._id)
    : [];

  // The regime ledger's stable view: regimes this company is confirmed
  // exposed to, independent of whether this specific run's bounded query
  // budget happened to re-surface them. Falls back to nothing for
  // pre-ledger findings (regimeId/ledger rows only exist going forward).
  const activeRegimeFindings = activeRegimeExposures
    .map((e) => findings.find((f) => f._id === e.exposure.lastFindingId))
    .filter((f): f is Finding => f !== undefined);
  const activeRegimeFindingIds = new Set(activeRegimeFindings.map((f) => f._id));

  // A named, established-status regime this run identified but that didn't
  // clear the ledger's admission bar (e.g. only secondary sources so far) is
  // still a real, meaningful research result — not a generic development,
  // and not confirmed enough for the stable ledger. It gets its own group
  // rather than either being promoted into "Active Regulatory Regimes" (that
  // would weaken the ledger gate) or silently dropped from the page.
  const potentialRegimeFindings = currentFindings.filter(
    (f) => isEstablishedRegime(f) && !activeRegimeFindingIds.has(f._id),
  );
  // A forward-looking item whose own dates are too stale to confidently
  // call it current (temporalStatus === "STATUS_UNKNOWN", set by a
  // deterministic date check, never a live re-fetch) gets its own group
  // instead of inflating "Upcoming / Changing" — an old, unconfirmed
  // consultation isn't the same claim as a genuinely current one.
  const needsVerification = currentFindings.filter((f) => f.temporalStatus === "STATUS_UNKNOWN");
  const upcomingOrChanging = currentFindings.filter(
    (f) => isUpcomingOrChanging(f) && f.temporalStatus !== "STATUS_UNKNOWN",
  );
  const recentDevelopments = currentFindings.filter(
    (f) =>
      !activeRegimeFindingIds.has(f._id) &&
      !upcomingOrChanging.includes(f) &&
      !needsVerification.includes(f) &&
      !isEstablishedRegime(f),
  );
  const jurisdictionCount = new Set([
    ...currentFindings.map((f) => f.jurisdiction),
    ...activeRegimeFindings.map((f) => f.jurisdiction),
  ]).size;
  const hasLandscapeContent = currentFindings.length > 0 || activeRegimeFindings.length > 0;

  function handleSelectFinding(id: Id<"findings">) {
    setHighlightedId(id);
    const el = document.getElementById(`finding-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current));
    }, 2200);
  }

  async function handleSendBriefing(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSendState("sending");
    try {
      await sendBriefing({ companyId, toEmail: email.trim() });
      setSendState("sent");
    } catch {
      setSendState("error");
    }
  }

  const isRunning = latestRun?.status === "pending" || latestRun?.status === "running";

  return (
    <section className="landscape">
      <div className="landscape-heading">
        <CompanyBadge name={company.name} />
        <h2>{company.name}</h2>
        {latestRun && (
          <span className={`run-status run-status-${latestRun.status}`}>
            {isRunning && <span className="loading-spinner loading-spinner-inline" aria-hidden="true" />}
            {RUN_STATUS_LABELS[latestRun.status] ?? latestRun.status}
          </span>
        )}
      </div>
      <p className="requested-jurisdiction">
        Jurisdiction: <strong>{latestRun?.requestedJurisdiction ?? "Global"}</strong>
      </p>

      {latestRun?.status === "error" && (
        <div className="error-box">
          <p>Research couldn't complete{latestRun.error ? `: ${latestRun.error}` : "."}</p>
        </div>
      )}

      {profile && <CompanyProfileCard profile={profile} />}

      {hasLandscapeContent && (
        <ExecutiveSummary
          activeCount={activeRegimeFindings.length}
          upcomingCount={upcomingOrChanging.length}
          developmentsCount={recentDevelopments.length}
          jurisdictionCount={jurisdictionCount}
        />
      )}

      {hasLandscapeContent && (
        <RegulatoryExposureMap
          companyName={company.name}
          regimeFindings={activeRegimeFindings}
          onSelectFinding={handleSelectFinding}
        />
      )}

      {!hasLandscapeContent && latestRun?.status === "done" && (
        <div className="empty-state">
          <p>No regulatory findings for this company yet. Try broadening the jurisdiction or re-running research.</p>
        </div>
      )}

      <FindingGroup
        title="Active Regulatory Regimes"
        subtitle="Established regulations/frameworks confirmed relevant to this company, including ones this run didn't re-query."
        items={activeRegimeFindings}
        accent="active"
        highlightedId={highlightedId}
      />
      <FindingGroup
        title="Potential / Unconfirmed Regulatory Signals"
        subtitle="Named regimes identified this run that aren't yet confirmed enough for the stable ledger — e.g. only secondary sources so far."
        items={potentialRegimeFindings}
        accent="potential"
        highlightedId={highlightedId}
      />
      <FindingGroup
        title="Upcoming / Changing"
        subtitle="Consultations, proposed rules, and implementation changes to watch."
        items={upcomingOrChanging}
        accent="upcoming"
        highlightedId={highlightedId}
      />
      <FindingGroup
        title="Needs Verification"
        subtitle="Consultations or proposed changes old enough that their current status can't be confirmed from what this run retrieved."
        items={needsVerification}
        accent="unverified"
        highlightedId={highlightedId}
      />
      <FindingGroup
        title="Regulatory Developments"
        subtitle="Enforcement, investigations, guidance, and other developments relevant to this company."
        items={recentDevelopments}
        accent="developments"
        highlightedId={highlightedId}
      />

      <div className="briefing-card">
        <div className="briefing-card-text">
          <strong>Get this briefing by email</strong>
          <p>Send the current regulatory landscape to your inbox via AgentMail.</p>
        </div>
        <form className="briefing-form" onSubmit={handleSendBriefing}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={sendState === "sending" || !email.trim()}>
            {sendState === "sending" ? "Sending…" : "Email me this briefing"}
          </button>
          {sendState === "sent" && <span className="sent-ok">Sent!</span>}
          {sendState === "error" && (
            <span className="sent-error">Couldn't send the briefing. Please try again.</span>
          )}
        </form>
      </div>
    </section>
  );
}

function ExecutiveSummary({
  activeCount,
  upcomingCount,
  developmentsCount,
  jurisdictionCount,
}: {
  activeCount: number;
  upcomingCount: number;
  developmentsCount: number;
  jurisdictionCount: number;
}) {
  return (
    <div className="exec-summary">
      <div className="exec-stat">
        <span className="exec-stat-value">{activeCount}</span>
        <span className="exec-stat-label">Active regimes</span>
      </div>
      <div className="exec-stat">
        <span className="exec-stat-value">{upcomingCount}</span>
        <span className="exec-stat-label">Upcoming</span>
      </div>
      <div className="exec-stat">
        <span className="exec-stat-value">{developmentsCount}</span>
        <span className="exec-stat-label">Developments</span>
      </div>
      <div className="exec-stat">
        <span className="exec-stat-value">{jurisdictionCount}</span>
        <span className="exec-stat-label">Jurisdictions</span>
      </div>
    </div>
  );
}

// A bare "72/100" reads like raw model output; a qualitative label reads
// like an analyst's assessment. The exact score is still one hover away
// via the title attribute — no information lost, just led with the more
// scannable form.
function confidenceLabel(score: number): string {
  if (score >= 80) return "High confidence";
  if (score >= 50) return "Moderate confidence";
  return "Low confidence";
}

function CompanyProfileCard({ profile }: { profile: Doc<"companyProfiles"> }) {
  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <span className="section-label">Company Intelligence Brief</span>
        <span
          className="badge profile-confidence"
          title={`Profile confidence score: ${profile.confidence}/100`}
        >
          {confidenceLabel(profile.confidence)}
        </span>
      </div>
      <div className="profile-sector-row">
        <strong className="profile-sector">{profile.primarySector}</strong>
        {profile.secondarySectors.length > 0 && (
          <span className="profile-secondary"> · {profile.secondarySectors.join(", ")}</span>
        )}
      </div>
      <p className="profile-business-model">{profile.businessModel}</p>
      <div className="profile-field">
        <span className="field-label">Regulatory exposure</span>
        <div className="profile-exposure">
          {profile.regulatoryExposureAreas.map((area) => (
            <span key={area} className="badge">
              {area}
            </span>
          ))}
        </div>
      </div>
      {profile.geographicFootprint.length > 0 && (
        <div className="profile-field">
          <span className="field-label">Geographic footprint</span>
          <p className="profile-footprint">{profile.geographicFootprint.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

// Company -> Regulatory Exposure Areas -> Regulatory Regimes, with
// jurisdiction/regulator as attributes on each regime and an Active/Upcoming
// status color. The map answers one question — "what regimes currently
// govern, or are about to govern, this company?" — so it's built only from
// the regime ledger's stable exposures (regimeFindings), never from
// developments/enforcement/other finding types: those are event/action
// types and finding categories, not regime statuses, and stay represented
// in the finding-group sections below the map instead. The lanes/chips are
// built from the ledger's stable exposures rather than only this run's own
// findings, so a regime a run doesn't happen to re-query still appears
// here. Skips rendering rather than forcing a map when there's nothing to
// show.
function RegulatoryExposureMap({
  companyName,
  regimeFindings,
  onSelectFinding,
}: {
  companyName: string;
  regimeFindings: Finding[];
  onSelectFinding: (id: Id<"findings">) => void;
}) {
  if (regimeFindings.length === 0) return null;

  // Group by a case-insensitive, whitespace-normalized key so exact case/
  // format variants of the same regulatoryArea text (e.g. differing only in
  // capitalization) collapse into one lane — never a fuzzy/semantic merge,
  // just the same string modulo case and stray whitespace. The first-seen
  // original text is kept as the lane's display label.
  const normalizeAreaKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const areaOrder: string[] = [];
  const areaLabel = new Map<string, string>();
  const areaMap = new Map<string, Finding[]>();
  for (const f of regimeFindings) {
    const raw = f.regulatoryArea?.trim() || "Other";
    const key = normalizeAreaKey(raw);
    if (!areaMap.has(key)) {
      areaMap.set(key, []);
      areaOrder.push(key);
      areaLabel.set(key, raw);
    }
    areaMap.get(key)!.push(f);
  }

  return (
    <div className="exposure-map">
      <span className="section-label">Regulatory Exposure Map</span>
      <p className="exposure-map-subtitle">
        Current and forthcoming regimes — click one to jump to its finding.
      </p>

      <div className="exposure-map-legend">
        <span>
          <i className="legend-dot legend-active" /> Active
        </span>
        <span className="legend-provenance">
          <ProvenanceTick /> Regulator source
        </span>
      </div>

      <div className="exposure-map-root">
        <div className="exposure-map-company-node">
          <CompanyBadge name={companyName} size="sm" />
          {companyName}
        </div>
      </div>

      <div className="exposure-map-lanes">
        {areaOrder.map((area) => (
          <div className="exposure-lane" key={area}>
            <div className="exposure-lane-header">
              {areaLabel.get(area)}
              <span className="exposure-lane-count">{areaMap.get(area)!.length}</span>
            </div>
            <div className="exposure-lane-chips">
              {areaMap.get(area)!.map((f) => {
                const isUpcoming = f.status === "FUTURE_OR_PROPOSED";
                const isRegulatorSourced = f.sourceQuality === "TIER_1_REGULATOR_GOVERNMENT";
                return (
                  <button
                    key={f._id}
                    className={
                      "regime-chip " + (isUpcoming ? "regime-chip-upcoming" : "regime-chip-active")
                    }
                    onClick={() => onSelectFinding(f._id)}
                    title={`${f.regimeKey ?? f.title} — ${f.jurisdiction} — ${f.regulator}`}
                  >
                    <span className="regime-chip-body">
                      <span className="regime-chip-top">
                        <i className="regime-chip-dot" aria-hidden="true" />
                        <span className="regime-chip-name">{f.regimeKey ?? f.title}</span>
                      </span>
                      <span className="regime-chip-meta">
                        <span className="regime-chip-jurisdiction">
                          <JurisdictionIcon />
                          {f.jurisdiction}
                        </span>
                        <span className="regime-chip-regulator">
                          {f.regulator}
                          {isRegulatorSourced && (
                            <span
                              className="regime-chip-provenance"
                              title="Sourced to a regulator/government publication"
                            >
                              <ProvenanceTick />
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="regime-chip-arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const GROUP_ACCENT_CLASS: Record<
  "active" | "potential" | "upcoming" | "unverified" | "developments",
  string
> = {
  active: "finding-group-active",
  potential: "finding-group-potential",
  upcoming: "finding-group-upcoming",
  unverified: "finding-group-unverified",
  developments: "finding-group-developments",
};

function FindingGroup({
  title,
  subtitle,
  items,
  accent,
  highlightedId,
}: {
  title: string;
  subtitle: string;
  items: Finding[];
  accent: "active" | "potential" | "upcoming" | "unverified" | "developments";
  highlightedId: Id<"findings"> | null;
}) {
  if (items.length === 0) return null;

  return (
    <div className={`finding-group ${GROUP_ACCENT_CLASS[accent]}`}>
      <div className="finding-group-heading">
        <span className={`group-dot group-dot-${accent}`} />
        <h3 className="finding-group-title">{title}</h3>
        <span className="finding-group-count">{items.length}</span>
      </div>
      <p className="finding-group-subtitle">{subtitle}</p>
      <ul className="findings">
        {items.map((f) => (
          <FindingCard key={f._id} finding={f} highlighted={f._id === highlightedId} />
        ))}
      </ul>
    </div>
  );
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourcesList({ finding }: { finding: Finding }) {
  if (finding.sources.length === 0) return null;
  const [primary, ...secondary] = finding.sources;
  // sourceQuality is a per-finding evidence-tier judgment, not a per-URL
  // verification — the engine's own authority ranking (which sorts this
  // array) is a separate, weaker domain-pattern heuristic, and the two
  // can disagree (a finding can be tagged TIER_1 while its actual listed
  // sources are all secondary/vendor domains). Attaching the tag directly
  // to whichever link happened to sort first would risk labeling a
  // non-authoritative domain "Regulator / government source" — a real
  // overclaim. Showing it next to the "Sources" label instead states an
  // honest, already-true fact ("this finding's evidence tier is X")
  // without implying any one specific link is individually verified.
  const qualityLabel = finding.sourceQuality ? SOURCE_QUALITY_LABELS[finding.sourceQuality] : null;
  const showQualityTag = qualityLabel && finding.sourceQuality !== "TIER_3_SECONDARY_REPORTING";

  return (
    <div className="sources">
      <div className="sources-header">
        <span className="field-label">Sources</span>
        {showQualityTag && <span className="source-quality-tag">{qualityLabel}</span>}
      </div>
      <a href={primary.url} target="_blank" rel="noreferrer" className="source-link source-link-lead">
        {domainOf(primary.url)}
      </a>
      {secondary.length > 0 && (
        <details className="sources-secondary">
          <summary>
            +{secondary.length} supporting source{secondary.length > 1 ? "s" : ""}
          </summary>
          <div className="source-links">
            {secondary.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noreferrer" className="source-link">
                {domainOf(s.url)}
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ApplicabilityIndicator({
  level,
  evidence,
}: {
  level: string | undefined;
  evidence: string | undefined;
}) {
  if (!level && !evidence) return null;
  return (
    <span
      className="applicability-indicator"
      title="How central this regime is to the company's business, and how well the specific applicability claim is evidenced"
    >
      {evidence && <span className={`evidence-dot ${EVIDENCE_DOT_CLASS[evidence] ?? ""}`} />}
      {level ? APPLICABILITY_LABELS[level] ?? level : null}
      {level && evidence ? " · " : null}
      {evidence ? APPLICABILITY_EVIDENCE_LABELS[evidence] ?? evidence : null}
    </span>
  );
}

// statusCheckAt is a timestamp (when the engine's deterministic staleness
// check ran), not a free-text source-extracted date like the fields below
// it — formatted separately, and deliberately labeled "Status checked"
// rather than "verified": the check confirms the item's *age*, not its
// real-world outcome. See TEMPORAL_STATUSES in convex/schema.ts.
function formatCheckedDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function FindingCard({ finding: f, highlighted }: { finding: Finding; highlighted: boolean }) {
  const dates = [
    f.publicationDate && `Published ${f.publicationDate}`,
    f.effectiveDate && `Effective ${f.effectiveDate}`,
    f.implementationDate && `Implementation ${f.implementationDate}`,
    f.consultationDeadline && `Consultation deadline ${f.consultationDeadline}`,
    f.reportingDeadline && `Reporting deadline ${f.reportingDeadline}`,
    f.temporalStatus === "STATUS_UNKNOWN" &&
      f.statusCheckAt &&
      `Status checked ${formatCheckedDate(f.statusCheckAt)}`,
  ].filter(Boolean);

  return (
    <li id={`finding-${f._id}`} className={highlighted ? "finding finding-highlighted" : "finding"}>
      <div className="finding-top-row">
        {f.itemType && <span className="badge badge-muted">{ITEM_TYPE_LABELS[f.itemType] ?? f.itemType}</span>}
        {f.temporalStatus === "STATUS_UNKNOWN" && (
          <span
            className="badge badge-caution"
            title="This item's dates are old enough that its current status can't be confirmed from what this run retrieved"
          >
            Status requires verification
          </span>
        )}
        <span className="relevance">Relevance {f.relevanceScore}</span>
      </div>
      <h4 className="finding-title">{f.title}</h4>
      <p className="finding-meta">
        <strong className="finding-jurisdiction">{f.jurisdiction}</strong> · {f.regulator}
        {f.status && <> · {STATUS_LABELS[f.status] ?? f.status}</>}
      </p>
      {/* A supporting development (enforcement/guidance/news/etc.) reads as
          generic news unless it's visibly tied back to the regime it's
          about — regimeKey already carries this link, just not previously
          shown. A REGULATION_REGIME item IS the regime, so skip it there. */}
      {f.itemType && f.itemType !== "REGULATION_REGIME" && f.regimeKey && (
        <p className="finding-relates-to">Relates to {f.regimeKey}</p>
      )}
      <ApplicabilityIndicator level={f.applicabilityLevel} evidence={f.applicabilityEvidence} />
      <p className="finding-summary">{presentApplicabilityText(f.summary, f.applicabilityEvidence)}</p>
      <p className="why-it-matters">
        <strong>Why this matters</strong>
        {presentApplicabilityText(f.whyItMatters, f.applicabilityEvidence)}
      </p>
      {dates.length > 0 && <p className="finding-dates">{dates.join(" · ")}</p>}
      <SourcesList finding={f} />
    </li>
  );
}
