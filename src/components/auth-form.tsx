import { Link } from "@tanstack/react-router";
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { fieldErrors, LOGIN_ERRORS, type LoginErrorCode } from "@/lib/login";
import { cn } from "@/lib/utils";

/** The frame shared by the sign-in screens: app icon, title, a solid card and a footer line. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-svh place-items-center bg-window px-4 py-10">
      <div className="enter flex w-full max-w-[380px] flex-col items-center">
        <span
          aria-hidden
          className="grid size-14 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#5be38f,#22b45a)] text-[22px] font-semibold text-[#032d12] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_1px_2px_rgb(0_0_0/0.3)]"
        >
          N
        </span>
        <h1 className="mt-5 text-center text-[22px] leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-[32ch] text-center text-[13.5px] leading-snug font-light text-muted-foreground">
          {subtitle}
        </p>
        <div className="mt-7 w-full rounded-[20px] bg-card p-5 shadow-[inset_0_0_0_1px_var(--border),var(--shadow-panel)] sm:p-6">
          {children}
        </div>
        <p className="mt-6 text-center text-[13px] text-muted-foreground">{footer}</p>
      </div>
    </main>
  );
}

/** A text link between the sign-in screens that keeps the `next` destination. */
export function AuthLink({
  to,
  next,
  children,
  className,
}: {
  to: "/login" | "/criar-conta" | "/redefinir-senha";
  next: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      search={next ? { next } : {}}
      className={cn(
        "rounded-[4px] font-medium text-blue underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </Link>
  );
}

type FieldProps = {
  label: string;
  error?: string | undefined;
  hint?: ReactNode;
  /** Shown on the label's line, right-aligned (e.g. "Esqueceu a senha?"). */
  aside?: ReactNode;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
};

/** Label, control, then either the inline error or the hint below it. */
export function Field({ label, error, hint, aside, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground/90">
          {label}
        </label>
        {aside ? <span className="text-[12.5px]">{aside}</span> : null}
      </div>
      {children({ id, describedBy: note ? noteId : undefined })}
      {note ? (
        <p
          id={noteId}
          className={cn("text-[12.5px] leading-snug", error ? "text-red" : "text-tertiary")}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

const fieldClass = "h-11 rounded-[12px] px-3.5 text-[15px] md:text-[15px]";

export function AuthInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input {...props} className={cn(fieldClass, className)} />;
}

/** A password input with a show/hide toggle and a Caps Lock warning. */
export function PasswordInput({
  className,
  onCapsLock,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { onCapsLock?: (on: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(false);

  function toggle() {
    const input = inputRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    flushSync(() => setShown((value) => !value));
    if (!input || start === null || end === null) return;
    // Chrome rebuilds a field whose type changed on its next layout and moves the caret
    // to 0. Force that layout now, then put the caret back.
    void input.offsetWidth;
    input.setSelectionRange(start, end);
  }

  const capsLock = (event: KeyboardEvent<HTMLInputElement>) =>
    onCapsLock?.(event.getModifierState("CapsLock"));

  return (
    <div className="relative">
      <Input
        {...props}
        ref={inputRef}
        type={shown ? "text" : "password"}
        onKeyDown={capsLock}
        onKeyUp={capsLock}
        onBlur={(event) => {
          onCapsLock?.(false);
          props.onBlur?.(event);
        }}
        className={cn(fieldClass, "pr-12", className)}
      />
      <button
        type="button"
        aria-label={shown ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={shown}
        aria-controls={props.id}
        // Keeps the caret in the field when toggled with the mouse.
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
        className="press absolute inset-y-0 right-1.5 my-auto grid size-8 place-items-center rounded-full text-tertiary transition-colors hover:bg-fill-2 hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="press mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-opacity focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-70"
    >
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

const responseSchema = z.object({
  next: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

// Server refusals that belong to one field, so the message shows under it.
const CODE_FIELD: Partial<Record<string, string>> = {
  codigo: "accessCode",
  "email-em-uso": "email",
  "sem-conta": "email",
};

/** A short sideways shake, like a wrong macOS password; skipped with reduced motion. */
function shake(element: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-7px)" },
      { transform: "translateX(7px)" },
      { transform: "translateX(-5px)" },
      { transform: "translateX(5px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 400, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
  );
}

const values = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));

/**
 * Submits a sign-in form as JSON once hydrated (before that it posts natively). Validates on
 * submit, then re-validates a field when it loses focus; server errors land on the same fields.
 */
export function useAuthForm(
  endpoint: string,
  schema: z.ZodType,
  initialError: LoginErrorCode | undefined,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? LOGIN_ERRORS[initialError] : null,
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const submitted = useRef(false);

  function fail(form: HTMLFormElement, message: string | null, next: Record<string, string>) {
    setError(message);
    setFields(next);
    shake(form);
    const first = Object.keys(next)[0];
    const target = first ? form.elements.namedItem(first) : null;
    if (target instanceof HTMLInputElement) target.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    submitted.current = true;
    const parsed = schema.safeParse(values(form));
    if (!parsed.success) return fail(form, null, fieldErrors(parsed.error));

    setPending(true);
    setError(null);
    setFields({});
    let message = "Não foi possível continuar. Tente de novo.";
    let next: Record<string, string> = {};
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = responseSchema.catch({}).parse(await response.json().catch(() => ({})));
      if (response.ok) {
        // A full load, so the first render already runs with the new session.
        window.location.replace(body.next ?? "/");
        return;
      }
      if (body.error) message = body.error;
      next = body.fields ?? {};
      const field = body.code ? CODE_FIELD[body.code] : undefined;
      if (field && body.error) next = { ...next, [field]: body.error };
    } catch {
      message = "Sem conexão com o servidor.";
    }
    setPending(false);
    fail(form, Object.keys(next).length > 0 ? null : message, next);
  }

  /** After the first submit, re-checks the field that lost focus. */
  function onBlurCapture(event: FormEvent<HTMLFormElement>) {
    if (!submitted.current || !(event.target instanceof HTMLInputElement)) return;
    const name = event.target.name;
    const parsed = schema.safeParse(values(event.currentTarget));
    const message = parsed.success ? undefined : fieldErrors(parsed.error)[name];
    setFields(({ [name]: _old, ...rest }) => (message ? { ...rest, [name]: message } : rest));
  }

  return { pending, error, fields, onSubmit, onBlurCapture };
}

/** The form-level error (or a notice like Caps Lock), above the submit button when present. */
export function FormError({ message, notice }: { message: string | null; notice?: string | null }) {
  const text = message ?? notice;
  return (
    <p
      role="alert"
      className={cn(
        "-mb-1 text-center text-[13px] leading-snug empty:hidden",
        message ? "text-red" : "text-tertiary",
      )}
    >
      {text}
    </p>
  );
}
