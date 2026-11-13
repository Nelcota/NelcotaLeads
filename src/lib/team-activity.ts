import type { LeadEventKind } from "@/db/schema";
import { addDays, localDay, localTime } from "./format";
import { eventTime, MEETING_CANCELLED } from "./lead-history";
import { formatCents } from "./money";
import { LOSS_REASON_LABELS, LOSS_REASONS, SALES_STAGES } from "./schemas";

/** One row of the team feed, as the server returns it. */
export type ActivityEvent = {
  id: string;
  kind: LeadEventKind;
  fromValue: string | null;
  toValue: string | null;
  userId: string | null;
  leadId: string;
  leadName: string;
  createdAt: Date;
};

/** The feed line: "Phellipe" "marcou reunião com" "Clínica Lumière" — "Amanhã, 10:00". */
export type ActivityLine = {
  id: string;
  kind: LeadEventKind;
  whoId: string | null;
  who: string;
  verb: string;
  leadId: string;
  leadName: string;
  extra: string | null;
  day: string;
  when: string;
};

type Names = ReadonlyMap<string, string>;

const STAGE_NAMES = { meeting: "Reunião", proposal: "Proposta" } as const;
const MINUTE = 60_000;
const RECENT_HOURS = 6;

function cents(value: string | null): string | null {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? formatCents(amount) : null;
}

function ownerPhrase(event: ActivityEvent, names: Names): Pick<ActivityLine, "verb" | "extra"> {
  if (!event.toValue) return { verb: "liberou", extra: null };
  if (event.toValue === event.userId) return { verb: "pegou", extra: null };
  return { verb: "entregou", extra: `para ${names.get(event.toValue) ?? "pessoa removida"}` };
}

function stagePhrase(event: ActivityEvent): Pick<ActivityLine, "verb" | "extra"> {
  const to = SALES_STAGES.find((stage) => stage === event.toValue);
  if (to) return { verb: "moveu", extra: `para ${STAGE_NAMES[to]}` };
  return { verb: "tirou da etapa", extra: null };
}

function meetingPhrase(event: ActivityEvent): Pick<ActivityLine, "verb" | "extra"> {
  if (event.toValue === MEETING_CANCELLED) return { verb: "cancelou a reunião com", extra: null };
  const startsAt = event.toValue ? new Date(event.toValue) : null;
  const when = startsAt && !Number.isNaN(startsAt.getTime()) ? eventTime(startsAt) : null;
  const verb = event.fromValue ? "remarcou a reunião com" : "marcou reunião com";
  return { verb, extra: when ? `Para ${when}` : null };
}

function lostPhrase(event: ActivityEvent): Pick<ActivityLine, "verb" | "extra"> {
  const reason = LOSS_REASONS.find((item) => item === event.toValue);
  return { verb: "encerrou sem negócio", extra: reason ? LOSS_REASON_LABELS[reason] : null };
}

function phrase(event: ActivityEvent, names: Names): Pick<ActivityLine, "verb" | "extra"> {
  switch (event.kind) {
    case "owner":
      return ownerPhrase(event, names);
    case "stage":
      return stagePhrase(event);
    case "won":
      return { verb: "fechou", extra: cents(event.toValue) };
    case "lost":
      return lostPhrase(event);
    case "meeting":
      return meetingPhrase(event);
    case "proposal":
      return { verb: "montou proposta para", extra: cents(event.toValue) };
    default:
      return { verb: "mudou", extra: null };
  }
}

/** "Hoje", "Ontem" or "06/11", by Brazil day. */
export function activityDay(date: Date, now: Date): string {
  const day = localDay(date);
  const today = localDay(now);
  if (day === today) return "Hoje";
  if (day === addDays(today, -1)) return "Ontem";
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** "há 25 min" and "há 3 h" for the last hours, the clock time ("17:40") after that. */
export function activityTime(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / MINUTE));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < RECENT_HOURS * 60) return `há ${Math.floor(minutes / 60)} h`;
  return localTime(date);
}

/** The feed in words; `me` reads as "Você". */
export function activityLine(
  event: ActivityEvent,
  names: Names,
  me: string | null,
  now: Date,
): ActivityLine {
  const whoId = event.userId;
  const who = whoId === me ? "Você" : ((whoId ? names.get(whoId) : undefined) ?? "Alguém");
  return {
    id: event.id,
    kind: event.kind,
    whoId,
    who,
    ...phrase(event, names),
    leadId: event.leadId,
    leadName: event.leadName,
    day: activityDay(event.createdAt, now),
    when: activityTime(event.createdAt, now),
  };
}
