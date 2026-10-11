import { z } from "zod";

export const scoringCriterionSchema = z.object({
  label: z.string().trim().min(1, "Descreva o sinal").max(200),
  weight: z.number().int().min(-100).max(100),
});
export type ScoringCriterion = z.infer<typeof scoringCriterionSchema>;

export const DEFAULT_CRITERIA: ScoringCriterion[] = [
  { label: "Sem site", weight: 25 },
  { label: "Site desatualizado ou sem HTTPS", weight: 15 },
  { label: "Poucas avaliações no Google", weight: 10 },
  { label: "Nota abaixo de 4.0 no Google", weight: 10 },
  { label: "Sem presença em redes sociais", weight: 10 },
  { label: "Negócio ativo e com telefone", weight: 10 },
  { label: "Demais sinais identificados pela IA", weight: 20 },
];

export const TONES = ["formal", "consultivo", "direto"] as const;
export const TONE_LABELS: Record<(typeof TONES)[number], string> = {
  formal: "Formal",
  consultivo: "Consultivo",
  direto: "Direto",
};

export const settingsInputSchema = z.object({
  offer: z.string().trim().max(2000),
  idealCustomer: z.string().trim().max(2000),
  criteria: z.array(scoringCriterionSchema).max(20),
  tone: z.enum(TONES),
  senderName: z.string().trim().max(120),
  senderCompany: z.string().trim().max(120),
  messageScoreThreshold: z.number().int().min(0).max(100),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const MAX_RESULTS_LIMIT = 60;

export const newSearchSchema = z.object({
  niche: z.string().trim().min(2, "Informe o nicho").max(120),
  city: z.string().trim().min(2, "Informe a cidade").max(120),
  maxResults: z.number().int().min(1).max(MAX_RESULTS_LIMIT),
});
export type NewSearchInput = z.infer<typeof newSearchSchema>;

/** Business-contact data extracted from a lead's public website. */
export const siteDataSchema = z.object({
  finalUrl: z.string(),
  https: z.boolean(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  socialLinks: z.array(z.string()),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  copyrightYear: z.number().nullable(),
});
export type SiteData = z.infer<typeof siteDataSchema>;

/** Structured output requested from the model for each lead. */
export const leadAnalysisSchema = z.object({
  summary: z.string().describe("Resumo do negócio em 1 a 3 frases, só com dados fornecidos."),
  signals: z
    .array(z.string())
    .describe(
      "Sinais de oportunidade para a oferta (lacunas, problemas, ausências). Não liste pontos fortes do negócio.",
    ),
  painPoints: z.array(z.string()).describe("Dores prováveis do negócio relacionadas à oferta."),
  score: z.number().int().min(0).max(100).describe("Nota de 0 a 100 segundo os critérios."),
  scoreReasoning: z
    .string()
    .describe("Justificativa da nota, citando os critérios aplicados e as informações ausentes."),
});
export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

export const firstMessageSchema = z.object({
  firstMessage: z
    .string()
    .describe("Mensagem curta de primeiro contato em português do Brasil, pronta para WhatsApp."),
});

export const LEAD_STATUS_VALUES = ["new", "contacted", "replied", "closed", "discarded"] as const;
export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUS_VALUES)[number], string> = {
  new: "Novo",
  contacted: "Contatado",
  replied: "Respondeu",
  closed: "Fechado",
  discarded: "Descartado",
};

export const LEAD_SORT_FIELDS = ["score", "name", "rating", "reviewCount", "createdAt"] as const;

/** Lead list filters; shared by the table, the URL and the CSV export. */
export const leadFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  searchId: z.string().max(64).optional(),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  noWebsite: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  sort: z.enum(LEAD_SORT_FIELDS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export const updateLeadSchema = z.object({
  id: z.string().min(1),
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateMessageSchema = z.object({
  analysisId: z.string().min(1),
  firstMessage: z.string().trim().max(2000),
});
