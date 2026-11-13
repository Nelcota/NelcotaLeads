import { dayDiff, localDay } from "./format";

/** How far back the free-lead line still counts in days; older ones show the date. */
const DAYS_SHOWN = 30;

/** "agora", "há 25 min", "há 2 h", "ontem", "há 5 dias" (up to 30), then "11/10". */
export function agoText(date: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  const days = dayDiff(localDay(date), localDay(now));
  if (days <= 0 && minutes < 60) return `há ${minutes} min`;
  if (days <= 0) return `há ${Math.floor(minutes / 60)} h`;
  if (days === 1) return "ontem";
  if (days <= DAYS_SHOWN) return `há ${days} dias`;
  const day = localDay(date);
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

type FreeLeadTimes = {
  status: string;
  createdAt: Date;
  lastEmailAt: Date | null;
  /** The lead's latest real e-mail to us; null when it answered another way (WhatsApp). */
  repliedAt?: Date | null;
};

/**
 * The line after the stage label of a free lead: "há 2 h" (when it answered), "e-mail há
 * 3 dias" (contacted) or "chegou ontem" (new). The stage already says "Respondeu", so it is not
 * repeated. A replied lead reads its own last e-mail, not ours.
 */
export function freeLeadInfo(lead: FreeLeadTimes, now: Date): string {
  if (lead.status === "new") return `chegou ${agoText(lead.createdAt, now)}`;
  if (lead.status === "replied") {
    const answered = lead.repliedAt ?? lead.lastEmailAt;
    return answered ? agoText(answered, now) : "";
  }
  if (!lead.lastEmailAt) return "";
  return `e-mail ${agoText(lead.lastEmailAt, now)}`;
}
