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
import { LOGIN_ERROR_CODES, signInSchema } from "@/lib/login";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    next: z.string().max(2000).optional().catch(undefined),
    error: z.enum(LOGIN_ERROR_CODES).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Entrar · Nelcota Leads" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { next, error: errorCode } = Route.useSearch();
  const form = useAuthForm("/api/login", signInSchema, errorCode);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <AuthShell
      title="Entrar no Nelcota Leads"
      subtitle="Use o e-mail e a senha da sua conta."
      footer={
        <>
          Ainda não tem conta?{" "}
          <AuthLink to="/criar-conta" next={next}>
            Criar conta
          </AuthLink>
        </>
      }
    >
      {/* Posts natively before hydration; once hydrated, the hook takes over. */}
      <form
        method="post"
        action="/api/login"
        noValidate
        className="grid gap-4"
        onSubmit={(event) => void form.onSubmit(event)}
        onBlurCapture={form.onBlurCapture}
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="E-mail" error={form.fields.email}>
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
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the first field of a sign-in screen
              autoFocus
              readOnly={form.pending}
              aria-invalid={form.fields.email ? true : undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field
          label="Senha"
          error={form.fields.password}
          aside={
            <AuthLink to="/redefinir-senha" next={next}>
              Esqueceu a senha?
            </AuthLink>
          }
        >
          {({ id, describedBy }) => (
            <PasswordInput
              id={id}
              name="password"
              autoComplete="current-password"
              maxLength={512}
              readOnly={form.pending}
              onCapsLock={setCapsLock}
              aria-invalid={form.fields.password ? true : undefined}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <FormError message={form.error} notice={capsLock ? "Caps Lock ativado." : null} />
        <SubmitButton pending={form.pending}>{form.pending ? "Entrando…" : "Entrar"}</SubmitButton>
      </form>
    </AuthShell>
  );
}
