export const LOGIN_ERROR_CODES = ["senha", "limite", "config"] as const;

export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];

/** Login failures shown on the login screen; the code travels in `?error=` when JS is off. */
export const LOGIN_ERRORS: Record<LoginErrorCode, string> = {
  senha: "Senha incorreta.",
  limite: "Muitas tentativas erradas. Tente de novo amanhã.",
  config: "Senha de acesso não configurada. Defina APP_PASSWORD (8+ caracteres).",
};
