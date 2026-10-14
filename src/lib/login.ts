import { z } from "zod";
import { MAX_PASSWORD_LENGTH } from "./password";

export { MAX_PASSWORD_LENGTH };
export const MIN_PASSWORD_LENGTH = 8;

/** Sign-in screens: shown without the app shell, reachable without a session. */
export const AUTH_PAGES: ReadonlySet<string> = new Set([
  "/login",
  "/criar-conta",
  "/redefinir-senha",
]);

export const LOGIN_ERROR_CODES = [
  "senha",
  "limite",
  "config",
  "codigo",
  "email-em-uso",
  "sem-envio",
  "link-invalido",
  "invalido",
] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

/** Failures shown on the sign-in screens; the code travels in `?error=` when JS is off. */
export const LOGIN_ERRORS: Record<LoginErrorCode, string> = {
  senha: "E-mail ou senha incorretos.",
  limite: "Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.",
  config: "O acesso ainda não foi configurado. Fale com quem administra o sistema.",
  codigo: "Código de acesso incorreto.",
  "email-em-uso": "Já existe uma conta com esse e-mail.",
  "sem-envio":
    "A redefinição por e-mail ainda não está disponível. Fale com quem administra o sistema.",
  "link-invalido": "Este link expirou ou já foi usado. Peça um novo.",
  invalido: "Confira os campos destacados.",
};

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Informe o e-mail.")
  .max(254, "E-mail longo demais.")
  .pipe(z.email("E-mail inválido."));

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
  .max(MAX_PASSWORD_LENGTH, "Senha longa demais.");

const accessCode = z.string().min(1, "Informe o código de acesso.").max(MAX_PASSWORD_LENGTH);

const next = z.string().max(2000).optional();

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(MAX_PASSWORD_LENGTH),
  next,
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(80, "Nome longo demais."),
  email,
  password,
  accessCode,
  next,
});

/** Asks for a reset link. */
export const forgotPasswordSchema = z.object({ email, next });

/** Sets the new password, with the token from the link. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Abra o link enviado por e-mail.").max(200),
  password,
  next,
});

/** Shown after a reset link is asked, whether or not the e-mail has an account. */
export const RESET_SENT_NOTICE =
  "Se houver uma conta com esse e-mail, enviamos um link para criar uma senha nova. Ele vale por 1 hora.";

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** First message per field, for inline errors under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
