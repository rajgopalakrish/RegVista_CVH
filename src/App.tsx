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
      <header>
        <h1>RegVista</h1>
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
  const companies = useQuery(api.companies.list);
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="company-picker">
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Company name (e.g. Acme Corp)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Industry (optional)"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        />
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
        <button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Starting research…" : "Research"}
        </button>
      </form>

      {companies && companies.length > 0 && (
        <div className="recent-companies">
          <span>Recent:</span>
          {companies.map((c) => (
            <button
              key={c._id}
              className={c._id === selectedId ? "chip chip-active" : "chip"}
              onClick={() => onSelect(c._id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </section>
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

function RegulatoryLandscape({ companyId }: { companyId: Id<"companies"> }) {
  const company = useQuery(api.companies.get, { companyId });
  const landscape = useQuery(api.research.listByCompany, { companyId });
  const sendBriefing = useAction(api.notify.sendBriefing);

  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  if (!company || !landscape) return <p>Loading…</p>;

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

  return (
    <section className="landscape">
      <h2>{company.name}</h2>

      {latestRun && (
        <p className={`run-status run-status-${latestRun.status}`}>
          Research: {latestRun.status}
          {latestRun.status === "error" && latestRun.error
            ? ` — ${latestRun.error}`
            : ""}
        </p>
      )}
      {latestRun && (
        <p className="requested-jurisdiction">
          Jurisdiction: <strong>{latestRun.requestedJurisdiction ?? "Global / Auto-detect"}</strong>
        </p>
      )}

      {profile && <CompanyProfileCard profile={profile} />}

      {currentFindings.length === 0 && latestRun?.status === "done" && (
        <p>No findings yet for this company.</p>
      )}

      <FindingGroup
        title="Active Regulatory Regimes"
        subtitle="The most important established regulations/frameworks relevant to this company."
        items={activeRegimes}
      />
      <FindingGroup
        title="Upcoming / Changing"
        subtitle="Consultations, proposed rules, and implementation changes to watch."
        items={upcomingOrChanging}
      />
      <FindingGroup
        title="Recent Regulatory Developments"
        subtitle="Enforcement, investigations, guidance, and other developments."
        items={recentDevelopments}
      />

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
    </section>
  );
}

function CompanyProfileCard({ profile }: { profile: Doc<"companyProfiles"> }) {
  return (
    <div className="profile-card">
      <div className="profile-header">
        <strong>{profile.primarySector}</strong>
        {profile.secondarySectors.length > 0 && (
          <span className="profile-secondary"> · {profile.secondarySectors.join(", ")}</span>
        )}
        <span className="badge profile-confidence">Confidence {profile.confidence}/100</span>
      </div>
      <p className="profile-business-model">{profile.businessModel}</p>
      <div className="profile-exposure">
        {profile.regulatoryExposureAreas.map((area) => (
          <span key={area} className="badge">{area}</span>
        ))}
      </div>
      {profile.geographicFootprint.length > 0 && (
        <p className="profile-footprint">
          <strong>Footprint:</strong> {profile.geographicFootprint.join(", ")}
        </p>
      )}
    </div>
  );
}

function FindingGroup({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Finding[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="finding-group">
      <h3 className="finding-group-title">{title}</h3>
      <p className="finding-group-subtitle">{subtitle}</p>
      <ul className="findings">
        {items.map((f) => (
          <FindingCard key={f._id} finding={f} />
        ))}
      </ul>
    </div>
  );
}

function FindingCard({ finding: f }: { finding: Finding }) {
  const dates = [
    f.effectiveDate && `Effective: ${f.effectiveDate}`,
    f.implementationDate && `Implementation: ${f.implementationDate}`,
    f.consultationDeadline && `Consultation deadline: ${f.consultationDeadline}`,
    f.reportingDeadline && `Reporting deadline: ${f.reportingDeadline}`,
    f.publicationDate && `Published: ${f.publicationDate}`,
  ].filter(Boolean);

  return (
    <li className="finding">
      <div className="finding-header">
        <span className="badge">{f.jurisdiction}</span>
        <span className="badge">{f.regulator}</span>
        {f.itemType && <span className="badge">{ITEM_TYPE_LABELS[f.itemType] ?? f.itemType}</span>}
        {f.status && <span className="badge">{STATUS_LABELS[f.status] ?? f.status}</span>}
        {f.applicabilityLevel && (
          <span className="badge">{APPLICABILITY_LABELS[f.applicabilityLevel] ?? f.applicabilityLevel}</span>
        )}
        <span className="relevance">Relevance {f.relevanceScore}/100</span>
      </div>
      <h4>{f.title}</h4>
      <p>{f.summary}</p>
      <p className="why-it-matters">
        <strong>Why this matters:</strong> {f.whyItMatters}
      </p>
      {dates.length > 0 && <p className="finding-dates">{dates.join(" · ")}</p>}
      <div className="sources">
        {f.sources.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noreferrer">
            {s.title}
          </a>
        ))}
      </div>
    </li>
  );
}
