import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { emails, meetings, proposals, type Lead } from "@/db/schema";
import type { EmailText } from "@/lib/sales-email";

/**
 * What meeting invites and proposals need to go out by e-mail: the SALES_EMAILS_ENABLED flag
 * (off by default) and the mailbox they leave from (empty while it is not connected).
 */
export type SalesMailDeps = { emailsEnabled: boolean; fromAddress: string };

export const SALES_EMAILS_OFF_MESSAGE =
  "O envio por e-mail está desligado. Salve sem enviar e copie o texto.";
export const MAILBOX_MISSING_MESSAGE =
  "A caixa de e-mail ainda não foi conectada por quem administra o sistema.";
export const NO_EMAIL_MESSAGE = "Este lead não tem e-mail.";
export const UNSUBSCRIBED_MESSAGE = "O lead pediu para não receber e-mails.";
/** Why a queued invite or proposal was not sent: the kill switch was turned off meanwhile. */
export const SALES_EMAILS_OFF_REASON = "Cancelado: envio de convites e propostas desligado";
export const SALES_RETRY_OFF_MESSAGE =
  "O envio de convites e propostas está desligado. Copie o texto e mande pelo canal da conversa.";

/** Whether the e-mail is a meeting invite or a proposal (the ones SALES_EMAILS_ENABLED gates). */
export async function isSalesEmail(db: Db, emailId: string): Promise<boolean> {
  const [meeting, proposal] = await Promise.all([
    db.query.meetings.findFirst({
      where: eq(meetings.inviteEmailId, emailId),
      columns: { id: true },
    }),
    db.query.proposals.findFirst({ where: eq(proposals.emailId, emailId), columns: { id: true } }),
  ]);
  return Boolean(meeting ?? proposal);
}

/**
 * A retried invite or proposal goes out as a new e-mail row: the meeting or proposal follows
 * it, so its status (and the kill switch) keep tracking what is actually sent.
 */
export function relinkSalesEmail(db: Db, fromId: string, toId: string) {
  return db.batch([
    db.update(meetings).set({ inviteEmailId: toId }).where(eq(meetings.inviteEmailId, fromId)),
    db.update(proposals).set({ emailId: toId }).where(eq(proposals.emailId, fromId)),
  ]);
}

/** Throws the reason this lead cannot be e-mailed now, if there is one. */
export function assertCanEmail(lead: Pick<Lead, "email" | "unsubscribedAt">, deps: SalesMailDeps) {
  if (!deps.emailsEnabled) throw new Error(SALES_EMAILS_OFF_MESSAGE);
  if (!deps.fromAddress) throw new Error(MAILBOX_MISSING_MESSAGE);
  if (!lead.email) throw new Error(NO_EMAIL_MESSAGE);
  if (lead.unsubscribedAt) throw new Error(UNSUBSCRIBED_MESSAGE);
}

/**
 * The insert that puts a person's e-mail (already signed) in the send queue; the regular send
 * picks it up within the daily limit and the gap between e-mails, in the lead's thread.
 */
export function queuedSalesEmail(
  db: Db,
  email: { id: string; leadId: string; toAddress: string; fromAddress: string; text: EmailText },
  now: Date,
) {
  return db.insert(emails).values({
    id: email.id,
    leadId: email.leadId,
    direction: "out",
    status: "queued",
    author: "user",
    fromAddress: email.fromAddress,
    toAddress: email.toAddress,
    subject: email.text.subject,
    body: email.text.body,
    sendAfter: now,
  });
}
