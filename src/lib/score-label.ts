import { SCORE_TIERS, scoreTier, type ScoreTier } from "@/lib/schemas";

/** The score as a level: the same bands the filters, badges and counts use. */
export function scoreLevel(score: number): ScoreTier {
  return scoreTier(score);
}

/** "Alta", "Média" or "Baixa". */
export function scoreLabel(score: number): string {
  return SCORE_TIERS[scoreLevel(score)].label;
}

/** What the levels mean, under "Como a nota foi calculada" in the lead panel. */
export const SCORE_LABEL_HELP =
  `Quanto a empresa combina com a sua oferta, segundo a IA (0 a 100). ` +
  `Alta a partir de ${SCORE_TIERS.high.min}, Média a partir de ${SCORE_TIERS.medium.min}. ` +
  `Leads de nota alta recebem e-mail primeiro.`;
