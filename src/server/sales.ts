import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { mailConfigured } from "@/lib/mail";
import { meetingCancelSchema, meetingInputSchema } from "@/lib/meetings";
import { proposalInputSchema } from "@/lib/proposal";
import { salesEmailsEnabled } from "@/lib/sales-email";
import { idSchema } from "@/lib/schemas";
import {
  cancelMeeting as cancelStoredMeeting,
  scheduleMeeting as scheduleStoredMeeting,
  upcomingMeetings,
} from "./meeting-store";
import { latestProposal, saveProposal as saveStoredProposal } from "./proposal-store";
import { requestUserId } from "./request-user";
import type { SalesMailDeps } from "./sales-mail";

/** The flag and the mailbox: e-mails go out only with SALES_EMAILS_ENABLED on and a mailbox. */
function salesMailDeps(): SalesMailDeps {
  return {
    emailsEnabled: salesEmailsEnabled(env.SALES_EMAILS_ENABLED),
    fromAddress: mailConfigured(env) ? (env.MAIL_ADDRESS ?? "").toLowerCase() : "",
  };
}

/** The lead's upcoming meetings, its latest proposal and whether invites can be e-mailed. */
export const getLeadSales = createServerFn({ method: "GET" })
  .validator(z.object({ leadId: idSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    const deps = salesMailDeps();
    const [meetings, proposal] = await Promise.all([
      upcomingMeetings(db, data.leadId),
      latestProposal(db, data.leadId),
    ]);
    return {
      meetings,
      proposal,
      emailsEnabled: deps.emailsEnabled && deps.fromAddress !== "",
    };
  });

/** "Agendar reunião". */
export const scheduleMeeting = createServerFn({ method: "POST" })
  .validator(meetingInputSchema)
  .handler(async ({ data }) =>
    scheduleStoredMeeting(getDb(), data, await requestUserId(), salesMailDeps()),
  );

/** "Cancelar" on an upcoming meeting. */
export const cancelMeeting = createServerFn({ method: "POST" })
  .validator(meetingCancelSchema)
  .handler(async ({ data }) => cancelStoredMeeting(getDb(), data.id, await requestUserId()));

/** "Salvar proposta" and "Enviar proposta por e-mail". */
export const saveProposal = createServerFn({ method: "POST" })
  .validator(proposalInputSchema)
  .handler(async ({ data }) =>
    saveStoredProposal(getDb(), data, await requestUserId(), salesMailDeps()),
  );
