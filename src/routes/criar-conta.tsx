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
import { LOGIN_ERROR_CODES, MIN_PASSWORD_LENGTH, signUpSchema } from "@/lib/login";

export const Route = createFileRoute("/criar-conta")({
  validateSearch: z.object({
    next: z.string().max(2000).optional().catch(undefined),
    error: z.enum(LOGIN_ERROR_CODES).optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: "Criar conta · Nelcota Leads" }] }),
  component: SignUpPage,
});

function SignUpPage() {
  const { next, error: errorCode } = Route.useSearch();
  const form = useAuthForm("/api/signup", signUpSchema, errorCode);
  const [capsLock, setCapsLock] = useState(false);
  const invalid = (name: string) => (form.fields[name] ? true : undefined);

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Você vai precisar do código de acesso da sua equipe."
      footer={
        <>
          Já tem conta?{" "}
          <AuthLink to="/login" next={next}>
            Entrar
          </AuthLink>
        </>
      }
    >
      <form
        method="post"
        action="/api/signup"
        noValidate
        className="grid gap-4"
        onSubmit={(event) => void form.onSubmit(event)}
        onBlurCapture={form.onBlurCapture}
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Nome" error={form.fields.name}>
          {({ id, describedBy }) => (
            <AuthInput
              id={id}
              name="name"
              autoComplete="name"
              placeholder="Como você quer ser chamado"
              maxLength={80}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the first field of a sign-up screen
              autoFocus
              readOnly={form.pending}
              aria-invalid={invalid("name")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
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
              readOnly={form.pending}
              aria-invalid={invalid("email")}
              aria-describedby={describedBy}
            />
          )}
        </Field>
        <Field
          label="Senha"
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
          {form.pending ? "Criando conta…" : "Criar conta"}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
