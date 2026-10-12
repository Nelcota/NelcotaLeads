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
import { LOGIN_ERROR_CODES, MIN_PASSWORD_LENGTH, resetPasswordSchema } from "@/lib/login";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: z.object({
    next: z.string().max(2000).optional().catch(undefined),
    error: z.enum(LOGIN_ERROR_CODES).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Redefinir senha · Nelcota Leads" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { next, error: errorCode } = Route.useSearch();
  const form = useAuthForm("/api/reset-password", resetPasswordSchema, errorCode);
  const [capsLock, setCapsLock] = useState(false);
  const invalid = (name: string) => (form.fields[name] ? true : undefined);

  return (
    <AuthShell
      title="Redefinir senha"
      subtitle="Com o código de acesso, você define uma senha nova. Os outros navegadores saem da conta."
      footer={
        <>
          Lembrou a senha?{" "}
          <AuthLink to="/login" next={next}>
            Entrar
          </AuthLink>
        </>
      }
    >
      <form
        method="post"
        action="/api/reset-password"
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
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the first field of this screen
              autoFocus
              readOnly={form.pending}
              aria-invalid={invalid("email")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
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
              readOnly={form.pending}
              onCapsLock={setCapsLock}
              aria-invalid={invalid("password")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field
          label="Código de acesso"
          error={form.fields.accessCode}
          hint="Peça a quem administra o sistema."
        >
          {({ id, describedBy }) => (
            <PasswordInput
              id={id}
              name="accessCode"
              autoComplete="off"
              maxLength={512}
              readOnly={form.pending}
              onCapsLock={setCapsLock}
              aria-invalid={invalid("accessCode")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <FormError message={form.error} notice={capsLock ? "Caps Lock ativado." : null} />
        <SubmitButton pending={form.pending}>
          {form.pending ? "Salvando…" : "Salvar senha e entrar"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
