import type { LeadAnalysis } from "@/lib/schemas";
import type { CallUsage, LeadAnalyzer } from "./analyzer";

const MOCK_USAGE: CallUsage = { model: "mock", tokensIn: 0, tokensOut: 0, cost: 0 };

/** Rule-based stand-in for the LLM so the app runs without a DeepSeek key. */
export function createMockAnalyzer(): LeadAnalyzer {
  return {
    name: "mock",
    async analyze(_settings, lead) {
      const signals: string[] = [];
      const painPoints: string[] = [];
      let score = 0;
      if (lead.siteStatus === "none") {
        score += 25;
        signals.push("Sem site cadastrado no Google");
        painPoints.push("Pouca visibilidade para quem pesquisa na internet");
      } else if (lead.siteStatus === "unreachable") {
        score += 15;
        signals.push("Site cadastrado fora do ar");
        painPoints.push("Clientes podem não encontrar informações confiáveis");
      } else if (lead.siteData && !lead.siteData.https) {
        score += 15;
        signals.push("Site sem HTTPS");
      }
      if ((lead.reviewCount ?? 0) < 30) {
        score += 10;
        signals.push("Poucas avaliações no Google");
      }
      if (lead.rating !== null && lead.rating < 4) {
        score += 10;
        signals.push("Nota abaixo de 4.0 no Google");
        painPoints.push("Reputação online pode estar afastando clientes");
      }
      if (!lead.siteData?.socialLinks.length) {
        score += 10;
        signals.push("Sem redes sociais identificadas");
      }
      if (lead.hasPhone) score += 10;
      const analysis: LeadAnalysis = {
        summary: `[Simulado] ${lead.name} atua em ${lead.niche.toLowerCase()} em ${lead.city ?? "cidade desconhecida"}.`,
        signals,
        painPoints,
        score: Math.min(100, score),
        scoreReasoning:
          "[Simulado] Nota calculada por regras fixas porque DEEPSEEK_API_KEY não está configurada.",
      };
      return { analysis, usage: MOCK_USAGE };
    },
    async writeMessage(settings, lead) {
      const signature = [settings.senderName, settings.senderCompany].filter(Boolean).join(" | ");
      const message = [
        `Olá, equipe ${lead.name}! Tudo bem?`,
        `Trabalho com ${settings.offer || "soluções digitais para negócios locais"} e vi que vocês atendem em ${lead.city ?? "sua cidade"}. Posso compartilhar uma ideia rápida de como atrair mais clientes pela internet?`,
        signature,
        "Se preferir não receber mensagens, é só responder SAIR.",
      ]
        .filter(Boolean)
        .join("\n\n");
      return { message, usage: MOCK_USAGE };
    },
  };
}
