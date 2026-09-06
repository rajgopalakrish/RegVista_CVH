import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { JURISDICTIONS } from "../convex/schema";
import type { Doc, Id } from "../convex/_generated/dataModel";

const AUTO_DETECT = "";

export default function App() {
  const [companyId, setCompanyId] = useState<Id<"companies"> | null>(null);

  return (
    <div className="app">
      <header className="app-header">
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

// An item without itemType is pre-ontology test data (from before this
// field set existed) — shown in "Recent Developments" as a fallback so
// nothing silently disappears, rather than assuming a bucket for it.
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

  const { latestRun, findings, profile } = landscape;
  // Only the latest run's findings — a watchlist, not an ever-growing dump
  // of every research run this company has ever had.
  const currentFindings = latestRun
    ? findings.filter((f) => f.researchRunId === latestRun._id)
    : [];
  const activeRegimes = currentFindings.filter(isEstablishedRegime);
  const upcomingOrChanging = currentFindings.filter(isUpcomingOrChanging);
  const recentDevelopments = currentFindings.filter(
    (f) => !activeRegimes.includes(f) && !upcomingOrChanging.includes(f),
  );
  const jurisdictionCount = new Set(currentFindings.map((f) => f.jurisdiction)).size;

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
        <h2>{company.name}</h2>
        {latestRun && (
          <span className={`run-status run-status-${latestRun.status}`}>
            {isRunning && <span className="loading-spinner loading-spinner-inline" aria-hidden="true" />}
            {RUN_STATUS_LABELS[latestRun.status] ?? latestRun.status}
          </span>
        )}
      </div>
      <p className="requested-jurisdiction">
        Jurisdiction: <strong>{latestRun?.requestedJurisdiction ?? "Global / Auto-detect"}</strong>
      </p>

      {latestRun?.status === "error" && (
        <div className="error-box">
          <p>Research couldn't complete{latestRun.error ? `: ${latestRun.error}` : "."}</p>
        </div>
      )}

      {profile && <CompanyProfileCard profile={profile} />}

      {currentFindings.length > 0 && (
        <ExecutiveSummary
          activeCount={activeRegimes.length}
          upcomingCount={upcomingOrChanging.length}
          developmentsCount={recentDevelopments.length}
          jurisdictionCount={jurisdictionCount}
        />
      )}

      {currentFindings.length > 0 && (
        <RegulatoryExposureMap companyName={company.name} findings={currentFindings} onSelectFinding={handleSelectFinding} />
      )}

      {currentFindings.length === 0 && latestRun?.status === "done" && (
        <div className="empty-state">
          <p>No regulatory findings for this company yet. Try broadening the jurisdiction or re-running research.</p>
        </div>
      )}

      <FindingGroup
        title="Active Regulatory Regimes"
        subtitle="The most important established regulations/frameworks relevant to this company."
        items={activeRegimes}
        accent="active"
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
        title="Recent Regulatory Developments"
        subtitle="Enforcement, investigations, guidance, and other developments."
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
            <span className="sent-error">Couldn't send — check server logs.</span>
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

function CompanyProfileCard({ profile }: { profile: Doc<"companyProfiles"> }) {
  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <span className="section-label">Company Intelligence Brief</span>
        <span className="badge profile-confidence">Confidence {profile.confidence}/100</span>
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
// jurisdiction/regulator as attributes on each regime and an
// Active/Upcoming/Enforcement status color — built entirely from this
// run's own REGULATION_REGIME findings (grouped by their regulatoryArea),
// no separate graph data or mock content. Skips rendering rather than
// forcing a map when there's nothing regime-shaped to show.
function RegulatoryExposureMap({
  companyName,
  findings,
  onSelectFinding,
}: {
  companyName: string;
  findings: Finding[];
  onSelectFinding: (id: Id<"findings">) => void;
}) {
  const regimeFindings = findings.filter((f) => f.itemType === "REGULATION_REGIME");
  if (regimeFindings.length === 0) return null;

  const areaOrder: string[] = [];
  const areaMap = new Map<string, Finding[]>();
  for (const f of regimeFindings) {
    const key = f.regulatoryArea?.trim() || "Other";
    if (!areaMap.has(key)) {
      areaMap.set(key, []);
      areaOrder.push(key);
    }
    areaMap.get(key)!.push(f);
  }

  // A regime is flagged "enforcement" when some other finding from this
  // run (any itemType) sharing its regimeKey is itself an enforcement
  // development — connecting two already-independent findings visually.
  const enforcedRegimeKeys = new Set(
    findings
      .filter((f) => f.status === "ENFORCEMENT_DEVELOPMENT" && f.regimeKey)
      .map((f) => f.regimeKey as string),
  );

  return (
    <div className="exposure-map">
      <span className="section-label">Regulatory Exposure Map</span>
      <p className="exposure-map-subtitle">
        How {companyName}'s regulatory exposure connects to the regimes, regulators, and
        jurisdictions that matter — click a regime to jump to its finding.
      </p>

      <div className="exposure-map-root">
        <div className="exposure-map-company-node">{companyName}</div>
      </div>

      <div className="exposure-map-lanes">
        {areaOrder.map((area) => (
          <div className="exposure-lane" key={area}>
            <div className="exposure-lane-header">{area}</div>
            <div className="exposure-lane-chips">
              {areaMap.get(area)!.map((f) => {
                const isUpcoming = f.status === "FUTURE_OR_PROPOSED";
                const isEnforced = f.regimeKey ? enforcedRegimeKeys.has(f.regimeKey) : false;
                return (
                  <button
                    key={f._id}
                    className={
                      "regime-chip " +
                      (isUpcoming ? "regime-chip-upcoming" : "regime-chip-active") +
                      (isEnforced ? " regime-chip-enforced" : "")
                    }
                    onClick={() => onSelectFinding(f._id)}
                    title={`${f.regimeKey ?? f.title} — ${f.jurisdiction} — ${f.regulator}`}
                  >
                    <span className="regime-chip-name">{f.regimeKey ?? f.title}</span>
                    <span className="regime-chip-meta">
                      {f.jurisdiction} · {f.regulator}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="exposure-map-legend">
        <span>
          <i className="legend-dot legend-active" /> Active
        </span>
        <span>
          <i className="legend-dot legend-upcoming" /> Upcoming
        </span>
        <span>
          <i className="legend-dot legend-enforced" /> Enforcement
        </span>
      </div>
    </div>
  );
}

const GROUP_ACCENT_CLASS: Record<"active" | "upcoming" | "developments", string> = {
  active: "finding-group-active",
  upcoming: "finding-group-upcoming",
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
  accent: "active" | "upcoming" | "developments";
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
  const qualityLabel = finding.sourceQuality ? SOURCE_QUALITY_LABELS[finding.sourceQuality] : null;

  return (
    <div className="sources">
      {qualityLabel && finding.sourceQuality !== "TIER_3_SECONDARY_REPORTING" && (
        <span className="source-quality-tag">{qualityLabel}</span>
      )}
      <div className="source-links">
        {finding.sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className={i === 0 ? "source-link source-link-lead" : "source-link"}
          >
            {domainOf(s.url)}
          </a>
        ))}
      </div>
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

function FindingCard({ finding: f, highlighted }: { finding: Finding; highlighted: boolean }) {
  const dates = [
    f.publicationDate && `Published ${f.publicationDate}`,
    f.effectiveDate && `Effective ${f.effectiveDate}`,
    f.implementationDate && `Implementation ${f.implementationDate}`,
    f.consultationDeadline && `Consultation deadline ${f.consultationDeadline}`,
    f.reportingDeadline && `Reporting deadline ${f.reportingDeadline}`,
  ].filter(Boolean);

  return (
    <li id={`finding-${f._id}`} className={highlighted ? "finding finding-highlighted" : "finding"}>
      <div className="finding-top-row">
        {f.itemType && <span className="badge badge-muted">{ITEM_TYPE_LABELS[f.itemType] ?? f.itemType}</span>}
        <span className="relevance">Relevance {f.relevanceScore}</span>
      </div>
      <h4 className="finding-title">{f.title}</h4>
      <p className="finding-meta">
        {f.jurisdiction} · {f.regulator}
        {f.status && <> · {STATUS_LABELS[f.status] ?? f.status}</>}
      </p>
      <ApplicabilityIndicator level={f.applicabilityLevel} evidence={f.applicabilityEvidence} />
      <p className="finding-summary">{f.summary}</p>
      <p className="why-it-matters">
        <strong>Why this matters</strong>
        {f.whyItMatters}
      </p>
      {dates.length > 0 && <p className="finding-dates">{dates.join(" · ")}</p>}
      <SourcesList finding={f} />
    </li>
  );
}
