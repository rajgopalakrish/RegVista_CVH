"use node";

import { v } from "convex/values";
import { AgentMailClient } from "agentmail";
import { action, env } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Sends the current regulatory landscape for a company as a briefing email
 * via AgentMail. Runs as an action (not a mutation) because it makes an
 * outbound network call — see convex/researchActions.ts for the same rule.
 */
export const sendBriefing = action({
  args: {
    companyId: v.id("companies"),
    toEmail: v.string(),
  },
  handler: async (ctx, { companyId, toEmail }) => {
    const company = await ctx.runQuery(api.companies.get, { companyId });
    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const { findings } = await ctx.runQuery(api.research.listByCompany, {
      companyId,
    });

    const inboxId = requireEnv("AGENTMAIL_INBOX_ID");
    const client = new AgentMailClient({ apiKey: requireEnv("AGENTMAIL_API_KEY") });

    const lines = findings.map(
      (f) =>
        `• [${f.jurisdiction} / ${f.regulator}] ${f.title} ` +
        `(relevance ${f.relevanceScore}/100)\n  ${f.whyItMatters}\n` +
        f.sources.map((s) => `  Source: ${s.title} — ${s.url}`).join("\n"),
    );

    const text =
      findings.length > 0
        ? `RegVista regulatory briefing for ${company.name}\n\n${lines.join("\n\n")}`
        : `RegVista regulatory briefing for ${company.name}\n\nNo findings yet — ` +
          `run research for this company first.`;

    await client.inboxes.messages.send(inboxId, {
      to: [toEmail],
      subject: `RegVista briefing: ${company.name}`,
      text,
    });
  },
});

function requireEnv(name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
