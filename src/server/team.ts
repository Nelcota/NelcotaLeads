import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { getDb } from "@/db/client";
import { getMailer, mailConfigured, newMessageId } from "@/lib/mail";
import {
  flagOn,
  inviteEmailText,
  inviteInputSchema,
  removeInviteSchema,
  signUpUrl,
  type InviteDelivery,
} from "@/lib/team";
import { requestOrigin, requestUserId } from "./request-user";
import { createInvite, pendingInvites, removeInvite, teamWithLeads } from "./team-store";

/** TEAM_INVITE_EMAILS_ENABLED (off by default): invites are e-mailed only with "true". */
function inviteEmailsEnabled(): boolean {
  return flagOn(env.TEAM_INVITE_EMAILS_ENABLED);
}

/** "Equipe": the accounts with their leads, the pending invites and whether invites are e-mailed. */
export const getTeam = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const [members, invites] = await Promise.all([teamWithLeads(db), pendingInvites(db)]);
  return { members, invites, inviteEmailsEnabled: inviteEmailsEnabled() };
});

export type Team = Awaited<ReturnType<typeof getTeam>>;

/** E-mails the invite from the app's mailbox; a failure keeps the invite and is reported. */
async function sendInviteEmail(to: string, origin: string): Promise<InviteDelivery> {
  if (!inviteEmailsEnabled()) return "off";
  if (!mailConfigured(env)) return "no-mailbox";
  const mailer = getMailer(env);
  const text = inviteEmailText(signUpUrl(origin));
  try {
    await mailer.send({
      from: { address: mailer.address, name: "Equipe Nelcota" },
      to,
      subject: text.subject,
      text: text.body,
      messageId: newMessageId(mailer.address),
    });
    return "sent";
  } catch (error) {
    console.error(
      JSON.stringify({ level: "error", event: "team.invite_email_failed", error: String(error) }),
    );
    return "failed";
  }
}

/** "Convidar": stores the invite and, with TEAM_INVITE_EMAILS_ENABLED on, e-mails it. */
export const inviteTeammate = createServerFn({ method: "POST" })
  .validator(inviteInputSchema)
  .handler(async ({ data }) => {
    const invite = await createInvite(getDb(), data.email, await requestUserId(), new Date());
    const delivery = await sendInviteEmail(invite.email, await requestOrigin());
    return { ...invite, delivery };
  });

/** "Remover" on a pending invite. */
export const deleteInvite = createServerFn({ method: "POST" })
  .validator(removeInviteSchema)
  .handler(async ({ data }) => {
    await removeInvite(getDb(), data.id);
    return { ok: true as const };
  });
