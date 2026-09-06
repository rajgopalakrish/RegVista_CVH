# RegVista — Demo script

Target: ~3 minutes, live product at https://brilliant-roadrunner-68.convex.site,
no localhost. Engineering is frozen — this script describes the **current**
deployed product and current live data (verified against the deployment
immediately before writing this). Do not re-run research on camera unless
the "Convex proof" beat calls for it — every company below already has a
completed run sitting in the "Recent" list.

**The thesis, in one line:** Company → business exposure → regulatory
regimes → developments → evidence. RegVista is not a regulatory news feed,
not a legal research database, and not a compliance workflow tool — it's a
live map from what a company *does* to the specific regimes that follow
from it, with every claim traceable to a primary source.

---

## 1. Opening (15–20s)

> "You can look up any company's stock price in five seconds. You can't look
> up its regulatory world nearly as fast — that lives across dozens of
> regulator sites, law-firm memos, and news archives. RegVista fixes that:
> give it a company, and it builds that world for you — the regimes that
> actually apply, why they apply, and the evidence behind every claim."

Stay on the landing page for this beat — don't click yet. Let the header
("Enter a company. See its regulatory world.") sit on screen.

---

## 2. Grab — ~60s

**Click:** "Grab Holdings" in the Recent list (jurisdiction: Singapore).

**Company Intelligence (≈10s).** Point at the profile card:
> "RegVista inferred this — Grab is a super-app: ride-hailing, food
> delivery, and digital payments across Southeast Asia. That's the starting
> point for everything else on this page — not a hardcoded label."

**Exposure Map (≈12s).** Pan across the lanes:
> "That business model becomes six regulatory domains: data protection,
> competition, payments, transport, anti-money laundering. This map *is*
> the product — everything below it is evidence for what's on it."

**Two regimes, clicked (≈18s).** Click the **Competition Act** chip:
> "Competition and Consumer Commission of Singapore. Directly evidenced,
> core exposure — Grab's ride-hailing dominance and its 2018 acquisition of
> Uber's Southeast Asia business put it squarely under this Act."

Then click **PDPA** or **Payment Services Act**:
> "Same pattern for data protection and for its MAS-licensed payments
> business — three different regulators, three different bodies of law,
> one company."

**Developments — the enforcement story (≈14s).** Scroll to "Regulatory
Developments" and point at the Grab–Uber item:
> "And this is where it stops being static. CCCS's 2018 infringement
> decision against Grab over the Uber merger — resolved in 2020 when
> Singapore's new point-to-point transport framework took effect. RegVista
> doesn't just list the regime, it surfaces what actually happened under
> it, dated, and tied back to the regime by name."

**Evidence (≈6s).** Expand the source on that finding:
> "And it's sourced to CCCS's own release, not a summary of a summary."

---

## 3. DBS — ~45s

**Click:** "DBS" in the Recent list. Same jurisdiction, completely
different business.

> "Same system, same code — switch to DBS: a bank. Retail, corporate and
> investment banking, wealth management, treasury. Watch the regulatory
> picture change completely."

**Breadth (≈20s).** Pan the exposure map / active regimes list without
reading every entry aloud:
> "Eleven active regimes versus Grab's six. Banking Act, the Financial
> Services and Markets Act, Payment Services Act — and a dense cluster of
> AML and counter-terrorism-financing regimes, because that's what a
> systemically important bank's compliance surface actually looks like.
> RegVista isn't repeating itself here — this *is* the shape of a bank's
> obligations."

**Upcoming — genuinely current (≈15s).** Scroll to "Upcoming / Changing"
and point at the Payment Services Act consultation:
> "This one's live right now — a MAS consultation on Payment Services Act
> amendments, with a comment deadline next month. This isn't a historical
> archive, it's a watchlist."

**Evidence (≈10s).** Click **Banking Act 1970** and expand its source:
> "Straight to sso.agc.gov.sg and MAS's own site — same evidentiary
> standard as Grab, applied to a completely different company."

---

## 4. Google — ~35–40s

**Click:** "Google" in the Recent list.

> "One more, to show the breadth isn't a fluke — Google. Advertising,
> cloud, search. The exposure map pivots again: competition and online
> safety, because Google runs YouTube and the Play Store in Singapore."

**Click the Competition Act 2004 chip**, then the **Online Safety
(Miscellaneous Amendments) Act 2022** chip (the one sourced to
`sso.agc.gov.sg` / `mddi.gov.sg`):
> "Competition Act again — different company, same regulator, same
> standard of evidence. And Singapore's Online Safety Act, because Google
> operates platforms that fall under IMDA's content-moderation codes —
> sourced straight to the statute and MDDI's own announcement."

> "Three companies, three unrelated businesses, three different regulatory
> shapes — from the same profiling and retrieval pipeline, with nothing
> company-specific hardcoded."

---

## 5. Convex / architecture proof — ~20s

**Click:** back to "Grab Holdings" in the Recent list (from Google).

> "One more thing worth ten seconds: Firecrawl pulls from primary regulator
> sources, OpenAI structures that into evidenced findings — once, per
> research run. Everything after that is Convex. Watch — I switch back to
> Grab and the entire landscape is back, instantly, no reload, no
> re-fetch. That's a reactive Convex query, not a page refresh."

Keep this beat short — it's a proof point, not a walkthrough. Don't open
the Convex dashboard or explain the schema.

---

## 6. Closing — ~10s

> "RegVista doesn't summarize regulatory news, and it isn't a compliance
> checklist. Give it a company, and it tells you exactly which regulatory
> world that company lives in — and shows its work."

---

## Recording checklist

**Browser/window setup**
- Full-screen or a maximized window at normal laptop/desktop width
  (≥1440px) — the shell is designed for that width; the exposure map's
  lanes lay out side by side there instead of scrolling.
- Fresh tab, no other tabs/bookmarks bar visible. Zoom at 100%.
- Live URL only: `https://brilliant-roadrunner-68.convex.site` — never
  localhost.

**Recommended starting page**
- Land on the homepage with the company picker + Recent list visible.
  All three demo companies (plus a leftover "Stripe" entry) are already in
  Recent — no need to type a company name or wait for a live research run.

**Recommended company order**
1. Grab Holdings (Singapore) — the anchor story, ~60s
2. DBS (Singapore) — breadth pivot, ~45s
3. Google (Singapore) — second breadth pivot, ~35–40s
4. Back to Grab Holdings — Convex reactivity proof, ~20s

**Screens to capture per company**
- Company Intelligence profile card (sector, business model, footprint)
- Regulatory Exposure Map (pan across lanes; click 1–2 chips)
- One "Regulatory Developments" or "Upcoming / Changing" item with dates
- One expanded source link showing a `.gov.sg` / `mas.gov.sg` domain

**What NOT to click**
- Don't scroll through an entire "Active Regulatory Regimes" list reading
  every entry aloud for any company — pick 2–3 chips on the map instead.
  The lists are long by design (that's the breadth story), but reading
  them item-by-item on camera slows the demo and surfaces the cosmetic
  issues below.
- Don't open "Potential / Unconfirmed Regulatory Signals" and "Active
  Regulatory Regimes" side by side for the same company back-to-back —
  see DBS caveat below.
- Don't trigger a brand-new research run on camera. It costs live
  Firecrawl/OpenAI calls, takes 30–90s, and its output can't be previewed
  ahead of time — every company needed for this script already has a
  completed run.
- Don't open the AgentMail briefing form unless you have time to spare —
  it's not part of this script and isn't needed to land the thesis.

**Known stale/cosmetic data to avoid on camera**

The regulatory engine is frozen, so these are documented rather than
fixed. All are harmless (evidence-hedging and the ledger's admission gate
already prevent anything worse) but look confusing in a close-up:

- **Google — "Code of Practice for Online Safety – App Distribution
  Services"** sits under "Active Regulatory Regimes" but its status badge
  reads *Future / proposed* — a pre-freeze ledger row from before a status
  fix landed, never re-confirmed since. Don't click it; use the Competition
  Act or Online Safety Act chips instead.
- **Google — "PDPA"** in the active list is sourced only to `cookie-script.com`
  / `cloud.google.com` / `cookieyes.com` / `onetrust.com` (vendor/blog
  domains) despite carrying a "Regulator / government source" tag — another
  pre-freeze row, self-heals on the next research run, not yet re-run. Do
  not expand its sources on camera. Use Competition Act or Online Safety
  Act for the "click a source" beat on Google instead.
- **Google — two "Online Safety (Miscellaneous Amendments) Act 2022"
  entries** and **two "Competition Act" entries** appear in the active list
  under slightly different regulatory-area labels (a legacy ledger dedup
  gap from before the current normalization logic). If you land on the raw
  list, don't count regimes aloud or point out the repetition.
- **Grab — "P2P Regulatory Framework" and "Point-to-Point Transport
  Regulatory Framework (P2P Regulatory Framework)"** are two ledger
  entries for the same real-world framework, worded differently by
  different research runs. Use Competition Act, PDPA, or Payment Services
  Act for the "click a regime" beat on Grab instead — all three are clean,
  single entries.
- **DBS — "Corruption, Drug Trafficking and Other Serious Crimes
  (Confiscation of Benefits) Act 1992"** appears in *both* "Active
  Regulatory Regimes" and "Potential / Unconfirmed Regulatory Signals"
  simultaneously (a stronger historical confirmation and a weaker recent
  one, pointing at the same regime). Don't show both sections open at once
  for DBS. Use Banking Act 1970, Payment Services Act 2019, or PDPA for the
  "click a source" beat on DBS instead — all cite `mas.gov.sg` / `sso.agc.gov.sg`
  / `pdpc.gov.sg` cleanly.
- **DBS — "Financial Services and Markets (Resolution of Financial
  Institutions) Regulations 2024"** is sourced only to `dbs.com` (the
  company's own site). Skip it for the evidence beat.

None of the above needs fixing before the demo — they're all
minor, honestly-labeled edge cases in already-shipped data, not active
bugs. The script above deliberately routes around every one of them.
