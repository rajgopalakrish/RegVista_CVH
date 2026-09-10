# RegVista

RegVista is a regulatory intelligence tool: enter a company, optionally
scope it to a jurisdiction, and see its regulatory landscape — active
regulatory regimes, upcoming or changing rules, and recent regulatory
developments, each backed by a source and a relevance score — plus an
emailed briefing of the findings.

Built on **Convex** for the database, functions, and real-time sync;
**Firecrawl** retrieves the real regulatory sources; **OpenAI** classifies
and structures the findings; **AgentMail** sends the emailed briefing.

**Live demo:** https://brilliant-roadrunner-68.convex.site

Built for the **Convex All Gas Hackathon** (sponsored by OpenAI, Firecrawl,
and AgentMail). See [`hackathon.md`](./hackathon.md) for the detailed
build log and submission write-up.

## Hackathon requirements

- **Backend**: Convex — database, functions, and real-time sync must run on Convex.
- **Data**: Firecrawl feeds the app real data (not just referenced in the README).
- **Inbox**: AgentMail gives the app its own inbox and does real work in the product.
- **Frontend hosting**: deployed publicly on Convex static hosting (`convex.site`) or ChatGPT Sites (`chatgpt.site`) — no localhost submissions.
- **Repo**: public GitHub repo (this one).
- **Build log**: [`hackathon.md`](./hackathon.md) tracks progress via the `/hackathon` skill and is what judges read.
- **Timeline**: started on/after Aug 25, 2026; submissions due Sept 22, 2026, 12:00 PM PT via vibeapps.dev.
- **Submission extras**: live URL, video demo (<3 min), and a social post tagging @convex, @OpenAI, @firecrawl, @agentmail.
