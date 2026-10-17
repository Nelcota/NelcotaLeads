import { z } from "zod";

/** Row ids (UUIDs today); bounded so a request cannot carry an arbitrarily long key. */
export const idSchema = z.string().min(1).max(64);

/**
 * Days a follow-up may be set to. A date field mid-typing sends "0002-10-13" on its way to
 * "2026-10-13", and the text comparisons against today would treat year 2 as overdue forever.
 */
export const DAY_RANGE = { min: "2000-01-01", max: "2099-12-31" } as const;

/** A real calendar day as YYYY-MM-DD within DAY_RANGE: no 2026-02-30, no 2026-13-01. */
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value < DAY_RANGE.min || value > DAY_RANGE.max) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const daySchema = z.string().refine(isCalendarDay, "Data inválida");

/** User-typed text: NFC so "é" typed as e + combining accent matches the precomposed one. */
const userText = () => z.string().normalize("NFC").trim();

export const scoringCriterionSchema = z.object({
  label: userText().min(1, "Descreva o sinal").max(200),
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
  offer: userText().max(2000),
  idealCustomer: userText().max(2000),
  criteria: z.array(scoringCriterionSchema).max(20),
  tone: z.enum(TONES),
  senderName: userText().max(120),
  senderCompany: userText().max(120),
  minScore: z.number().int().min(0).max(100),
});
export type SettingsInput = z.infer<typeof settingsInputSchema>;

/** Bounds of the "Respostas rápidas": how many, and how long each one may be. */
export const QUICK_REPLY_LIMITS = { count: 10, title: 60, body: 1000 } as const;

export const quickReplySchema = z.object({
  title: userText().min(1, "Dê um nome ao modelo").max(QUICK_REPLY_LIMITS.title),
  body: userText()
    .min(1, "Escreva o texto do modelo")
    .max(QUICK_REPLY_LIMITS.body, "Até 1.000 caracteres"),
});
export type QuickReplyInput = z.infer<typeof quickReplySchema>;

export const quickRepliesInputSchema = z.object({
  replies: z.array(quickReplySchema).max(QUICK_REPLY_LIMITS.count),
});
export type QuickRepliesInput = z.infer<typeof quickRepliesInputSchema>;

export const AUTOPILOT_RESULTS = [20, 40, 60] as const;

/** A niche + city the autopilot searches every day, rotating through the city's areas. */
export type AutopilotTarget = {
  niche: string;
  city: string;
  // Neighborhoods suggested by the AI; each run searches the next one for new places.
  areas: string[];
  cursor: number;
};

export const autopilotInputSchema = z.object({
  enabled: z.boolean(),
  aiAutoReply: z.boolean(),
  autoDispatch: z.boolean(),
  hour: z.number().int().min(0).max(23),
  results: z.union(AUTOPILOT_RESULTS.map((n) => z.literal(n))),
  targets: z
    .array(
      z.object({
        niche: userText().min(2, "Informe o nicho").max(120),
        city: userText().min(2, "Informe a cidade").max(120),
      }),
    )
    .max(10),
});
export type AutopilotInput = z.infer<typeof autopilotInputSchema>;

export const MAX_RESULTS_LIMIT = 60;

export const newSearchSchema = z.object({
  niche: userText().min(2, "Informe o nicho").max(120),
  city: userText().min(2, "Informe a cidade").max(120),
  maxResults: z.number().int().min(1).max(MAX_RESULTS_LIMIT),
});
export type NewSearchInput = z.infer<typeof newSearchSchema>;

/** Bounds for data scraped from a website; extractSite trims to fit them. */
export const SITE_LIMITS = {
  url: 2048,
  title: 300,
  description: 500,
  link: 500,
  email: 254,
  phone: 40,
  socialLinks: 10,
  emails: 5,
  phones: 5,
} as const;

export const siteDataSchema = z.object({
  finalUrl: z.string().max(SITE_LIMITS.url),
  https: z.boolean(),
  title: z.string().max(SITE_LIMITS.title).nullable(),
  description: z.string().max(SITE_LIMITS.description).nullable(),
  socialLinks: z.array(z.string().max(SITE_LIMITS.link)).max(SITE_LIMITS.socialLinks),
  emails: z.array(z.string().max(SITE_LIMITS.email)).max(SITE_LIMITS.emails),
  phones: z.array(z.string().max(SITE_LIMITS.phone)).max(SITE_LIMITS.phones),
  copyrightYear: z.number().int().min(1900).max(2200).nullable(),
});
export type SiteData = z.infer<typeof siteDataSchema>;

export const leadAnalysisSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(1000)
    .describe("O que a empresa faz e para quem, em 1 ou 2 frases simples."),
  signals: z
    .array(z.string().min(1).max(300))
    .max(10)
    .describe(
      "Sinais de oportunidade para a oferta (lacunas, problemas, ausências). Não liste pontos fortes do negócio.",
    ),
  painPoints: z
    .array(z.string().min(1).max(300))
    .max(10)
    .describe("Dores prováveis do negócio relacionadas à oferta."),
  score: z.number().int().min(0).max(100).describe("Nota de 0 a 100 segundo os critérios."),
  scoreReasoning: z
    .string()
    .min(1)
    .max(1000)
    .describe("Justificativa da nota, citando os critérios aplicados e as informações ausentes."),
});
export type LeadAnalysis = z.infer<typeof leadAnalysisSchema>;

/**
 * Lengths of generated text. `model` bounds what the model may return; `stored` what is kept
 * after the app adds to it (the WhatsApp opt-out line; an e-mail's signature and "sair" line),
 * which is also what an edit of that text may save, so a generated text can always be edited.
 */
export const TEXT_LIMITS = {
  message: { model: 2000, stored: 2100 },
  subject: { model: 200 },
  emailBody: { model: 5000, stored: 5500 },
} as const;

export const firstMessageSchema = z.object({
  firstMessage: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.message.model)
    .describe("Mensagem de WhatsApp curta e natural, em português do Brasil, seguindo as regras."),
});

export const followUpSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.message.model)
    .describe("Lembrete curto de WhatsApp, em português do Brasil, seguindo as regras."),
});

export const outreachEmailSchema = z.object({
  subject: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.subject.model)
    .describe("Assunto curto e específico, sem caixa alta nem ponto de exclamação."),
  body: z
    .string()
    .min(1)
    .max(TEXT_LIMITS.emailBody.model)
    .describe("Corpo do e-mail em texto simples, sem saudação final nem assinatura."),
});
export type OutreachEmail = z.infer<typeof outreachEmailSchema>;

export const EMAIL_ACTIONS = ["reply", "handoff", "close"] as const;
export const emailReplySchema = z.object({
  action: z
    .enum(EMAIL_ACTIONS)
    .describe(
      "reply: a IA responde. handoff: passar para a pessoa. close: a empresa não tem interesse ou pediu para não receber.",
    ),
  reason: z
    .string()
    .min(1)
    .max(1000)
    .describe("Motivo da decisão em uma frase curta, para o painel."),
  // reply and draft may be empty depending on the action, so no minimum.
  reply: z
    .string()
    .max(5000)
    .describe("Texto da resposta quando action = reply; vazio nos outros casos."),
  draft: z
    .string()
    .max(5000)
    .describe(
      "Quando action = handoff: sugestão de resposta para a pessoa revisar; vazio nos outros casos.",
    ),
});
export type EmailReplyDecision = z.infer<typeof emailReplySchema>;

export const areasSchema = z.object({
  areas: z
    .array(z.string().min(1).max(300))
    .max(40)
    .describe("Bairros ou regiões comerciais da cidade."),
});

export const LEAD_STATUS_VALUES = ["new", "contacted", "replied", "closed", "discarded"] as const;
export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUS_VALUES)[number], string> = {
  new: "Novo",
  contacted: "Contatado",
  replied: "Respondeu",
  closed: "Fechado",
  discarded: "Descartado",
};

/** Work queues shown in the leads inbox; each maps to a status (plus the follow-up day). */
export const LEAD_VIEWS = [
  "todo",
  "followup",
  "waiting",
  "talking",
  "closed",
  "discarded",
  "all",
] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];
export const LEAD_VIEW_LABELS: Record<LeadView, string> = {
  todo: "A contatar",
  followup: "Retornar hoje",
  waiting: "Aguardando resposta",
  talking: "Em conversa",
  closed: "Fechados",
  discarded: "Descartados",
  all: "Todos",
};

export const LEAD_SORT_FIELDS = ["score", "name", "rating", "reviewCount", "createdAt"] as const;

/** Lead list filters; shared by the table, the URL and the CSV export. */
export const leadFiltersSchema = z.object({
  q: userText().max(120).optional(),
  searchId: z.string().max(64).optional(),
  // A niche key from listNiches (the search's niche, lowercased).
  niche: z.string().max(120).optional(),
  view: z.enum(LEAD_VIEWS).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  noWebsite: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  hasEmail: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  sort: z.enum(LEAD_SORT_FIELDS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

/**
 * A route's search params, where a bad value (hand-edited or an old link: `?view=foo`,
 * `?minScore=500`) is dropped instead of failing the whole page. Server validators stay strict.
 */
export function lenientSearch<Shape extends Record<string, z.ZodOptional>>(
  schema: z.ZodObject<Shape>,
) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- same keys, each wrapped in .catch
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [key, field.catch(undefined)]),
  ) as { [K in keyof Shape]: z.ZodCatch<Shape[K]> };
  return z.object(shape);
}

export const updateLeadSchema = z.object({
  id: idSchema,
  status: z.enum(LEAD_STATUS_VALUES).optional(),
  notes: userText().max(5000).optional(),
  followUpOn: daySchema.nullable().optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

/**
 * Most leads one bulk action may touch: the whole visible list (LIST_LIMIT rows), since the
 * selection bar works on it.
 */
export const BULK_LIMIT = 1000;

/** E-mails sent per day when MAIL_DAILY_LIMIT is not set. */
export const DEFAULT_MAIL_DAILY_LIMIT = 30;

/** Minimum time between two outgoing e-mails, except answers to a message the lead sent. */
export const SEND_GAP_MINUTES = 8;

/** Most leads one "Disparar e-mail" may draft: each one is a model call made while you wait. */
export const DISPATCH_LIMIT = 100;

/** 2100-01-01T00:00:00Z: no timestamp the app writes comes close. */
export const MAX_UNIX_SECONDS = 4_102_444_800;

/** What a bulk status change replaced on one lead, so "Desfazer" can put it back. */
export const bulkSnapshotSchema = z.object({
  id: idSchema,
  status: z.enum(LEAD_STATUS_VALUES),
  followUpOn: daySchema.nullable(),
  discardReason: z.string().max(500).nullable(),
  // Unix seconds. Bounded so `new Date(seconds * 1000)` is a real date (an out-of-range one
  // turns into NaN, which D1 stores as NULL without a word).
  discardedAt: z.number().int().min(0).max(MAX_UNIX_SECONDS).nullable(),
});
export type BulkSnapshot = z.infer<typeof bulkSnapshotSchema>;

export const updateMessageSchema = z.object({
  analysisId: idSchema,
  firstMessage: userText().max(TEXT_LIMITS.message.stored),
});

/** Score bands used by filters, badges and counts. */
export const SCORE_TIERS = {
  high: { label: "Alta", min: 60, max: 100 },
  medium: { label: "Média", min: 30, max: 59 },
  low: { label: "Baixa", min: 0, max: 29 },
} as const;
export type ScoreTier = keyof typeof SCORE_TIERS;

export function scoreTier(score: number): ScoreTier {
  return score >= SCORE_TIERS.high.min
    ? "high"
    : score >= SCORE_TIERS.medium.min
      ? "medium"
      : "low";
}

/** The error a missing lead gives, so the screen can tell "gone" from "failed". */
export const LEAD_NOT_FOUND = "Lead não encontrado";

/** Largest stored profile photo; a 256px JPEG from `resizeAvatar` stays well under it. */
export const AVATAR_MAX_LENGTH = 200_000;

/** A profile photo, or `null` to remove it. Only raster data URLs, never a remote address. */
export const avatarInputSchema = z.object({
  avatar: z
    .string()
    .max(AVATAR_MAX_LENGTH, "Foto grande demais")
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Formato de foto inválido")
    .nullable(),
});
