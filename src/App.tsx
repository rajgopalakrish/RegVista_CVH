import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

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
      await startResearch({ companyId: newCompanyId });
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

function RegulatoryLandscape({ companyId }: { companyId: Id<"companies"> }) {
  const company = useQuery(api.companies.get, { companyId });
  const landscape = useQuery(api.research.listByCompany, { companyId });
  const sendBriefing = useAction(api.notify.sendBriefing);

  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  if (!company || !landscape) return <p>Loading…</p>;

  const { latestRun, findings } = landscape;

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

      {findings.length === 0 && latestRun?.status === "done" && (
        <p>No findings yet for this company.</p>
      )}

      <ul className="findings">
        {findings.map((f) => (
          <li key={f._id} className="finding">
            <div className="finding-header">
              <span className="badge">{f.jurisdiction}</span>
              <span className="badge">{f.regulator}</span>
              <span className="badge">{f.regulatoryArea}</span>
              <span className="relevance">Relevance {f.relevanceScore}/100</span>
            </div>
            <h3>{f.title}</h3>
            <p>{f.summary}</p>
            <p className="why-it-matters">
              <strong>Why this matters:</strong> {f.whyItMatters}
            </p>
            <div className="sources">
              {f.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>

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
