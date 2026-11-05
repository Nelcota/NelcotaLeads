import { z } from "zod";
import { SALES_SIGNATURE } from "./sales-email";
import { idSchema } from "./schemas";

/**
 * An on/off variable from the environment: on only with "true" (or "1"). Anything else,
 * unset included, is off, so every flag here is opt-in.
 */
export function flagOn(value: string | undefined): boolean {
  const flag = value?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

/** "Convidar": the partner's e-mail, compared in lowercase like the accounts. */
export const inviteInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail do sócio.")
    .max(254, "E-mail longo demais.")
    .pipe(z.email("E-mail inválido.")),
});
export type InviteInput = z.infer<typeof inviteInputSchema>;

export const removeInviteSchema = z.object({ id: idSchema });

/** Where an invited person creates the account. */
export const SIGN_UP_PATH = "/criar-conta";

export function signUpUrl(origin: string): string {
  return `${origin}${SIGN_UP_PATH}`;
}

/** Shown under the invite form while TEAM_INVITE_EMAILS_ENABLED is off. */
export const INVITE_EMAILS_OFF =
  "Envio do convite desligado: mande o link de criar conta para a pessoa";

export const ALREADY_INVITED_MESSAGE = "Esse e-mail já tem um convite pendente.";
export const ALREADY_MEMBER_MESSAGE = "Esse e-mail já tem conta na equipe.";
export const INVITE_NOT_FOUND_MESSAGE = "Esse convite não existe mais.";

/** "3 leads com ele". */
export function ownedLeadsLabel(count: number): string {
  return count === 1 ? "1 lead com ele" : `${count} leads com ele`;
}

/** Decided with the team on 2026-11-03: e-mails are signed by the team, never one person. */
export const SIGNATURE_DECISION = { signature: SALES_SIGNATURE, decidedOn: "03/11" } as const;

/** The e-mail a partner gets when TEAM_INVITE_EMAILS_ENABLED is on, signed by the team. */
export function inviteEmailText(link: string): { subject: string; body: string } {
  return {
    subject: "Convite para a equipe do Nelcota Leads",
    body: [
      "Olá!",
      "Você foi convidado para a equipe do Nelcota Leads. Crie sua conta com este e-mail no link abaixo:",
      link,
      "O código de acesso é pedido na criação da conta: peça a quem te convidou.",
      SALES_SIGNATURE,
    ].join("\n\n"),
  };
}

/** How "Convidar" went: stored only (sending off), e-mailed, or stored but the e-mail failed. */
export type InviteDelivery = "off" | "sent" | "failed" | "no-mailbox";
