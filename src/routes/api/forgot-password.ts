import { createFileRoute } from "@tanstack/react-router";
import { env, waitUntil } from "cloudflare:workers";
import { forgotPasswordSchema } from "@/lib/login";
import { getMailer, mailConfigured, newMessageId } from "@/lib/mail";
import { RESET_LINK_MINUTES, requestPasswordReset, type ResetMailer } from "@/server/auth";
import { handleAuthPost } from "@/server/auth-endpoint";

/**
 * Sent from the app's own mailbox. In the background, so the answer takes as long whether
 * or not the e-mail has an account.
 */
function resetMailer(): ResetMailer | null {
  if (!mailConfigured(env)) return null;
  const mailer = getMailer(env);
  return async ({ to, name, link }) => {
    const sending = mailer
      .send({
        from: { address: mailer.address, name: "Nelcota Leads" },
        to,
        subject: "Redefinir sua senha do Nelcota Leads",
        text: [
          `Olá, ${name}.`,
          `Para criar uma senha nova, abra este link em até ${RESET_LINK_MINUTES} minutos:`,
          link,
          "Se não foi você que pediu, ignore este e-mail. Sua senha continua a mesma.",
        ].join("\n\n"),
        messageId: newMessageId(mailer.address),
      })
      .catch((error: unknown) => console.error("reset: could not send the link", error));
    waitUntil(sending);
  };
}

export const Route = createFileRoute("/api/forgot-password")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleAuthPost(request, "/redefinir-senha", forgotPasswordSchema, (deps, input) =>
          requestPasswordReset(
            { ...deps, origin: new URL(request.url).origin, send: resetMailer() },
            input,
          ),
        ),
    },
  },
});
