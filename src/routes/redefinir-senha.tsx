import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  AuthInput,
  AuthLink,
  AuthShell,
  Field,
  FormError,
  PasswordInput,
  SubmitButton,
  useAuthForm,
} from "@/components/auth-form";
import {
  LOGIN_ERROR_CODES,
  MIN_PASSWORD_LENGTH,
  RESET_SENT_NOTICE,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/login";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: z.object({
    next: z.string().max(2000).optional().catch(undefined),
    error: z.enum(LOGIN_ERROR_CODES).optional().catch(undefined),
    // From the e-mailed link; without it the page asks for the e-mail.
    token: z.string().max(200).optional().catch(undefined),
    // Set after a native (pre-hydration) post asked for the link.
    sent: z.literal("1").optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Redefinir senha · Nelcota Leads" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { next, token } = Route.useSearch();
  return (
    <AuthShell
      title="Redefinir senha"
      subtitle={
        token
          ? "Escolha a senha nova. Os outros navegadores saem da conta."
          : "Informe o e-mail da conta. Enviamos um link para criar uma senha nova."
      }
      footer={
        <>
          Lembrou a senha?{" "}
          <AuthLink to="/login" next={next}>
            Entrar
          </AuthLink>
        </>
      }
    >
      {token ? <NewPasswordForm token={token} /> : <RequestLinkForm />}
    </AuthShell>
  );
}

function RequestLinkForm() {
  const { next, error: errorCode, sent } = Route.useSearch();
  const form = useAuthForm(
    "/api/forgot-password",
    forgotPasswordSchema,
    errorCode,
    sent ? RESET_SENT_NOTICE : null,
  );

  if (form.notice) {
    return (
      <p role="status" className="text-center text-[15px] leading-snug text-foreground/90">
        {form.notice}
      </p>
    );
  }

  return (
    <form
      method="post"
      action="/api/forgot-password"
      noValidate
      className="grid gap-4"
      onSubmit={(event) => void form.onSubmit(event)}
      onBlurCapture={form.onBlurCapture}
    >
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail da conta" error={form.fields.email}>
        {({ id, describedBy }) => (
          <AuthInput
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="voce@empresa.com.br"
            maxLength={254}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the only field of this screen
            autoFocus
            readOnly={form.pending}
            aria-invalid={form.fields.email ? true : undefined}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <FormError message={form.error} />
      <SubmitButton pending={form.pending}>
        {form.pending ? "Enviando…" : "Enviar link"}
      </SubmitButton>
    </form>
  );
}

function NewPasswordForm({ token }: { token: string }) {
  const { next, error: errorCode } = Route.useSearch();
  const form = useAuthForm("/api/reset-password", resetPasswordSchema, errorCode);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <form
      method="post"
      action="/api/reset-password"
      noValidate
      className="grid gap-4"
      onSubmit={(event) => void form.onSubmit(event)}
      onBlurCapture={form.onBlurCapture}
    >
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="Nova senha"
        error={form.fields.password}
        hint={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
      >
        {({ id, describedBy }) => (
          <PasswordInput
            id={id}
            name="password"
            autoComplete="new-password"
            maxLength={512}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- the only field of this screen
            autoFocus
            readOnly={form.pending}
            onCapsLock={setCapsLock}
            aria-invalid={form.fields.password ? true : undefined}
            aria-describedby={describedBy}
          />
        )}
      </Field>
      <FormError
        message={form.fields.token ?? form.error}
        notice={capsLock ? "Caps Lock ativado." : null}
      />
      <SubmitButton pending={form.pending}>
        {form.pending ? "Salvando…" : "Salvar senha e entrar"}
      </SubmitButton>
    </form>
  );
}
