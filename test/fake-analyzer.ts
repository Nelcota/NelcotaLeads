import type { LeadAnalyzer } from "@/lib/ai";

/** Deterministic test double for the DeepSeek analyzer (tests only). */
export function createFakeAnalyzer(score = 40): LeadAnalyzer {
  const usage = { model: "test-model", tokensIn: 100, tokensOut: 20, cost: 0.0001 };
  return {
    name: "test",
    analyze: async (_settings, lead) => ({
      analysis: {
        summary: `${lead.name} em ${lead.city ?? "?"}`,
        signals: lead.siteStatus === "none" ? ["Sem site"] : [],
        painPoints: [],
        score,
        scoreReasoning: "Teste",
      },
      usage,
    }),
    writeMessage: async (_settings, lead) => ({ message: `Olá, ${lead.name}`, usage }),
    writeFollowUp: async (_settings, lead, sent) => ({
      message: `Lembrete para ${lead.name} após ${sent.daysSince} dias`,
      usage,
    }),
    listAreas: async () => ({ areas: ["Centro", "Savassi"], usage }),
  };
}
