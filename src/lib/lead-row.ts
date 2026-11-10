import type { LeadStatus } from "@/db/schema";
import { dayDiff, dayMonth, localDay, localTime } from "@/lib/format";
import { LEAD_STATUS_LABELS, type SalesStage } from "@/lib/schemas";

/** The fields of a lead row these helpers read; the list rows carry all of them. */
export type LeadRowFacts = {
  status: LeadStatus;
  salesStage: SalesStage | null;
  analysisStatus: string;
  score: number | null;
  website: string | null;
  email: string | null;
  unsubscribedAt: Date | null;
  followUpOn: string | null;
  contactedAt: Date | null;
  lastEmailAt: Date | null;
  lastReplyAt: Date | null;
  nextMeetingAt: Date | null;
  createdAt: Date;
  signals: string[] | null;
};

/** The stages a lead row can show, from its status and, once it replied, its sales stage. */
export type LeadStage =
  | "new"
  | "contacted"
  | "replied"
  | "meeting"
  | "proposal"
  | "closed"
  | "discarded";

export const STAGE_LABELS: Record<LeadStage, string> = {
  ...LEAD_STATUS_LABELS,
  meeting: "Reunião",
  proposal: "Proposta",
};

/** A status color token (CSS variable) for line icons and short status text. */
export type StatusColor =
  | "var(--blue)"
  | "var(--teal)"
  | "var(--orange)"
  | "var(--green)"
  | "var(--yellow)"
  | "var(--red)";

/** Each stage has its own color for its line icon; the label stays neutral. */
export const STAGE_COLORS: Record<LeadStage, StatusColor> = {
  new: "var(--blue)",
  contacted: "var(--teal)",
  replied: "var(--orange)",
  meeting: "var(--green)",
  proposal: "var(--yellow)",
  closed: "var(--green)",
  discarded: "var(--red)",
};

export function leadStage(lead: Pick<LeadRowFacts, "status" | "salesStage">): LeadStage {
  if (lead.status === "replied" && lead.salesStage) return lead.salesStage;
  return lead.status;
}

/**
 * The one step forward "Mudar etapa" offers from the row. Meeting, proposal and closing need
 * their own forms in the lead panel, so the row only moves Novo → Contatado → Respondeu.
 */
export function nextStatus(
  status: LeadStatus,
): Extract<LeadStatus, "contacted" | "replied"> | null {
  if (status === "new") return "contacted";
  if (status === "contacted") return "replied";
  return null;
}

/** A lead ready for the first e-mail: analyzed, with an address that did not unsubscribe. */
export function isReadyToDispatch(
  lead: Pick<LeadRowFacts, "status" | "email" | "unsubscribedAt" | "analysisStatus">,
): boolean {
  return (
    lead.status === "new" &&
    Boolean(lead.email) &&
    !lead.unsubscribedAt &&
    lead.analysisStatus === "done"
  );
}

/** "Chegaram hoje": created in the last 24 hours (same window as the server filter). */
export function isFresh(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() < 24 * 60 * 60 * 1000;
}

const HOUR_MS = 60 * 60 * 1000;

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "há 2h", "há 3 dias": how long ago, for the next-step column. */
export function sinceLabel(date: Date, now: Date): string {
  const hours = Math.max(0, Math.floor((now.getTime() - date.getTime()) / HOUR_MS));
  if (hours < 1) return "agora há pouco";
  if (hours < 24) return `há ${hours}h`;
  return `há ${plural(Math.floor(hours / 24), "dia", "dias")}`;
}

export type NextStep = { text: string; color?: StatusColor };

function meetingLabel(startsAt: Date, today: string): string {
  const day = localDay(startsAt);
  const diff = dayDiff(today, day);
  const when = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : dayMonth(day);
  return `Reunião ${when} ${localTime(startsAt)}`;
}

function followUpStep(lead: LeadRowFacts, today: string): NextStep | null {
  const open = lead.status === "contacted" || lead.status === "replied";
  if (!open || !lead.followUpOn || lead.followUpOn > today) return null;
  if (lead.followUpOn === today) return { text: "Retorno hoje", color: "var(--orange)" };
  const late = dayDiff(lead.followUpOn, today);
  return { text: `Atrasado ${plural(late, "dia", "dias")}`, color: "var(--red)" };
}

function sentStep(lead: LeadRowFacts, now: Date): NextStep | null {
  const sent = lead.lastEmailAt ?? lead.contactedAt;
  if (lead.status !== "contacted" || !sent) return null;
  return { text: `Enviado ${sinceLabel(sent, now)}` };
}

function conversationStep(lead: LeadRowFacts, today: string, now: Date): NextStep | null {
  if (lead.status !== "replied") return null;
  if (lead.nextMeetingAt)
    return { text: meetingLabel(lead.nextMeetingAt, today), color: "var(--teal)" };
  if (lead.lastReplyAt) return { text: `Respondeu ${sinceLabel(lead.lastReplyAt, now)}` };
  return null;
}

/**
 * What decides who to handle first, for the "Próximo passo" column. The tab picks what the
 * column means: Retornar hoje shows the follow-up day, Aguardando when the last e-mail went
 * out, Em conversa the next meeting or the last reply; the other tabs show the most urgent.
 */
export function nextStep(
  lead: LeadRowFacts,
  today: string,
  now: Date,
  view?: "followup" | "waiting" | "talking" | "other",
): NextStep | null {
  if (view === "followup") return followUpStep(lead, today);
  if (view === "waiting") return sentStep(lead, now);
  if (view === "talking") return conversationStep(lead, today, now) ?? followUpStep(lead, today);
  return followUpStep(lead, today) ?? conversationStep(lead, today, now) ?? sentStep(lead, now);
}

/** "Nota 71 · Sem site · Poucas avaliações": the score's two main reasons, for its tooltip. */
export function scoreReasons(lead: Pick<LeadRowFacts, "score" | "signals">): string | undefined {
  if (lead.score === null) return undefined;
  const reasons = (lead.signals ?? []).slice(0, 2);
  return [`Nota ${lead.score}`, ...reasons].join(" · ");
}

/** The site's host without "www.", or null for a missing or broken address. */
export function siteHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname)
      return null;
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Whether the list may discard the lead itself. A closed deal reopens first (LEAD_TRANSITIONS),
 * and a lead in conversation ends through "Encerrar sem negócio", which records the reason the
 * loss metrics count; the list sends those to the lead panel.
 */
export function canDiscardFromList(status: LeadStatus): boolean {
  return status === "new" || status === "contacted";
}
