import type { LeadAnalyzer } from "@/lib/ai";
import type { EmailReplyDecision } from "@/lib/schemas";

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
    writeEmail: async (_settings, lead) => ({
      email: {
        subject: `Assunto para ${lead.name}`,
        body: `Olá, tudo bem? Texto para ${lead.name}.`,
      },
      usage,
    }),
    replyEmail: async (_settings, _lead, thread, guidance) => {
      const fromLead = thread.filter((message) => message.from === "empresa");
      const last = fromLead.at(-1)?.text.toLowerCase() ?? "";
      const decided: EmailReplyDecision["action"] = /preço|valor|quanto/.test(last)
        ? "handoff"
        : /não tenho interesse|sair/.test(last)
          ? "close"
          : "reply";
      // Asked by a person, it always writes something to review.
      const action = guidance && decided === "close" ? "handoff" : decided;
      return {
        decision: {
          action,
          reason: `Teste: ${action}`,
          reply:
            action !== "reply"
              ? ""
              : guidance?.draft
                ? "Resposta reescrita pela IA"
                : "Resposta da IA",
          draft: action === "handoff" ? "Rascunho para você" : "",
        },
        usage,
      };
    },
  };
}
