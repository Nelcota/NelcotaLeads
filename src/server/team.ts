import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { getMailer, mailConfigured, newMessageId } from "@/lib/mail";
import { overviewPeriodSchema } from "@/lib/period";
import {
  flagOn,
  inviteEmailText,
  inviteInputSchema,
  removeInviteSchema,
  signUpUrl,
  type InviteDelivery,
} from "@/lib/team";
import { teamMembers } from "./agenda-store";
import { requestOrigin, requestUserId } from "./request-user";
import { teamOverview } from "./team-overview";
import { createInvite, pendingInvites, pendingInviteEmail, removeInvite } from "./team-store";

/** TEAM_INVITE_EMAILS_ENABLED (off by default): invites are e-mailed only with "true". */
function inviteEmailsEnabled(): boolean {
  return flagOn(env.TEAM_INVITE_EMAILS_ENABLED);
}

/**
 * "Equipe": each partner's numbers for the period, the monthly goal, the free leads, the team's
 * activity, the pending invites, whether invites are e-mailed, and who is looking (`me`).
 */
export const getTeam = createServerFn({ method: "GET" })
  .validator(z.object({ period: overviewPeriodSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [overview, invites, me] = await Promise.all([
      teamOverview(db, data.period, new Date()),
      pendingInvites(db),
      requestUserId(),
    ]);
    return { ...overview, invites, inviteEmailsEnabled: inviteEmailsEnabled(), me };
  });

/** Everyone's id and name, for the owner chips of Leads and Conversas. */
export const listTeamMembers = createServerFn({ method: "GET" }).handler(() =>
  teamMembers(getDb()),
);

export type Team = Awaited<ReturnType<typeof getTeam>>;
export type TeamMember = Team["members"][number];

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

/** "Reenviar" on a pending invite; only e-mails with TEAM_INVITE_EMAILS_ENABLED on. */
export const resendInvite = createServerFn({ method: "POST" })
  .validator(removeInviteSchema)
  .handler(async ({ data }) => {
    const email = await pendingInviteEmail(getDb(), data.id);
    const delivery = await sendInviteEmail(email, await requestOrigin());
    return { delivery };
  });

/** "Remover" on a pending invite. */
export const deleteInvite = createServerFn({ method: "POST" })
  .validator(removeInviteSchema)
  .handler(async ({ data }) => {
    await removeInvite(getDb(), data.id);
    return { ok: true as const };
  });
