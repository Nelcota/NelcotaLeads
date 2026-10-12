import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { LOGIN_ERROR_CODES, LOGIN_ERRORS } from "@/lib/login";
import { cn } from "@/lib/utils";

const responseSchema = z.object({ next: z.string().optional(), error: z.string().optional() });

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
  const [error, setError] = useState<string | null>(errorCode ? LOGIN_ERRORS[errorCode] : null);
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const password = new FormData(event.currentTarget).get("password");
    if (typeof password !== "string" || password === "") {
      inputRef.current?.focus();
      return;
    }

    setPending(true);
    setError(null);
    let message = "Não foi possível entrar. Tente de novo.";
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password, next }),
      });
      const body = responseSchema.catch({}).parse(await response.json().catch(() => ({})));
      if (response.ok) {
        // A full load, so the first render already runs with the new session.
        window.location.replace(body.next ?? "/");
        return;
      }
      if (body.error) message = body.error;
    } catch {
      message = "Sem conexão com o servidor.";
    }
    setPending(false);
    setError(message);
    // Remounts the field: it shakes, clears and takes focus again (autoFocus), like macOS.
    setFailures((count) => count + 1);
  }

  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10">
      <div className="enter flex w-full max-w-[320px] flex-col items-center text-center">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-[18px] bg-[linear-gradient(180deg,#5be38f,#22b45a)] text-[26px] font-semibold text-[#032d12] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_1px_2px_rgb(0_0_0/0.3)]"
        >
          N
        </span>
        <h1 className="mt-5 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
          Nelcota Leads
        </h1>
        <p className="mt-1 text-[13px] font-light text-muted-foreground">
          Digite a senha para continuar.
        </p>

        {/* Posts natively before hydration; once hydrated, handleSubmit takes over. */}
        <form
          method="post"
          action="/api/login"
          noValidate
          className="mt-7 w-full"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <input type="hidden" name="next" value={next ?? ""} />
          {/* Lets password managers file the saved password under a stable account name. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="nelcota"
            readOnly
            hidden
          />
          <div key={failures} className={cn("relative", failures > 0 && "shake")}>
            <label htmlFor="password" className="sr-only">
              Senha
            </label>
            <Input
              ref={inputRef}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Senha"
              maxLength={512}
              required
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the only field on a login screen
              autoFocus
              readOnly={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby="login-error"
              className="h-11 rounded-full pr-[84px] pl-4 text-[15px] md:text-[15px]"
            />
            <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                aria-controls="password"
                // Keeps the caret in the field when toggled with the mouse.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowPassword((shown) => !shown)}
                className="press grid size-8 place-items-center rounded-full text-tertiary transition-colors hover:bg-fill-2 hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
              </button>
              <button
                type="submit"
                aria-label="Entrar"
                disabled={pending}
                className="press grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
              >
                {pending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <ArrowRightIcon className="size-4" strokeWidth={2.4} />
                )}
              </button>
            </div>
          </div>
          <p id="login-error" role="alert" className="mt-3 min-h-5 text-[13px] text-red">
            {error}
          </p>
        </form>

        <p className="mt-8 text-[11.5px] font-light text-tertiary">Acesso restrito.</p>
      </div>
    </main>
  );
}
