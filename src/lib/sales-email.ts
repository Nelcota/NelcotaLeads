import { addDays, dayMonth, formatDate, localDay, localTime, weekdayName } from "./format";
import { formatCents } from "./money";
import type { MeetingKind, ProposalItem } from "./schemas";
import { priceLabel } from "./services";
import { proposalTotals } from "./proposal";

/** Meeting invites and proposals are signed by the team, not by one person (2026-11-03). */
export const SALES_SIGNATURE = "Equipe Nelcota";

/** Shown wherever an e-mail would go out while SALES_EMAILS_ENABLED is off. */
export const SALES_EMAILS_OFF = "Envio por e-mail desligado";

export type EmailText = { subject: string; body: string };

/**
 * SALES_EMAILS_ENABLED: meeting invites and proposals are only e-mailed with "true" (or "1").
 * Anything else, including unset, keeps them off: sending is opt-in.
 */
export function salesEmailsEnabled(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

const KIND_PHRASE: Record<MeetingKind, string> = {
  video: "por videochamada (mandamos o link antes do horário)",
  call: "por ligação",
  in_person: "presencialmente",
};

function signed(paragraphs: readonly string[]): string {
  return [...paragraphs.filter(Boolean), SALES_SIGNATURE].join("\n\n");
}

/**
 * The invite the lead gets for a meeting: day, time (Brasília) and how it happens.
 * `leadName` is the Google listing name (often stuffed with keywords), so the body does not
 * greet by it: the date opens the e-mail.
 */
export function meetingInviteEmail(meeting: {
  leadName: string;
  startsAt: Date;
  kind: MeetingKind;
  note: string;
}): EmailText {
  const day = localDay(meeting.startsAt);
  const when = `${weekdayName(day).toLowerCase()}, ${dayMonth(day)}, às ${localTime(meeting.startsAt)}`;
  return {
    subject: `Nossa conversa: ${when}`,
    body: signed([
      `Nossa conversa fica marcada para ${when} (horário de Brasília), ${KIND_PHRASE[meeting.kind]}.`,
      meeting.note,
      "Se o horário não der, responda com outro que funcione para vocês.",
    ]),
  };
}

function itemLine(item: ProposalItem): string {
  return `- ${item.label}: ${priceLabel(item)}`;
}

/** The proposal as the client reads it: the lines, the total and until when it is valid. */
export function proposalEmail(proposal: {
  leadName: string;
  items: readonly ProposalItem[];
  validDays: number;
  today: string;
}): EmailText {
  const { totalCents, monthlyCents } = proposalTotals(proposal.items);
  const validUntil = formatDate(
    new Date(`${addDays(proposal.today, proposal.validDays)}T12:00:00-03:00`),
  );
  const monthly =
    monthlyCents > 0 ? ` (${formatCents(monthlyCents)} deste valor se repetem todo mês)` : "";
  return {
    subject: `Proposta da Nelcota para ${proposal.leadName}`,
    body: signed([
      "Segue a proposta com o que vamos fazer e o valor de cada parte:",
      proposal.items.map(itemLine).join("\n"),
      `Total: ${formatCents(totalCents)}${monthly}.`,
      `Proposta válida por ${proposal.validDays} dias, até ${validUntil}.`,
      "Se quiser mudar algum item, responda este e-mail.",
    ]),
  };
}
