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
import { ThemeToggle } from "@/components/theme-toggle";
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
    <main className="relative grid min-h-svh place-items-center bg-window px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6" />
      <div className="enter flex w-full max-w-[480px] flex-col items-center">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-[18px] bg-primary text-[26px] font-bold text-primary-foreground"
        >
          N
        </span>
        <h1 className="mt-5 text-center text-[27px] leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-2 max-w-[36ch] text-center text-[15px] leading-snug font-light text-muted-foreground">
          {subtitle}
        </p>
        <div className="mt-6 w-full rounded-[24px] bg-card p-6 shadow-[inset_0_0_0_1px_var(--border)] sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-[14px] text-muted-foreground">{footer}</p>
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
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-medium text-foreground/90">
          {label}
        </label>
        {aside ? <span className="text-[13.5px]">{aside}</span> : null}
      </div>
      {children({ id, describedBy: note ? noteId : undefined })}
      {note ? (
        <p
          id={noteId}
          className={cn("text-[13px] leading-snug", error ? "text-red" : "text-tertiary")}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}

const fieldClass = "h-12 rounded-[14px] px-4 text-[16px] md:text-[16px]";

// Urbanist draws the password bullet as a tiny dot; the system font draws a full-size one.
const maskedClass =
  "[font-family:system-ui,sans-serif] tracking-[0.18em] text-[18px] md:text-[18px]";

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
        className={cn(fieldClass, "pr-14", !shown && maskedClass, className)}
      />
      <button
        type="button"
        aria-label={shown ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={shown}
        aria-controls={props.id}
        // Keeps the caret in the field when toggled with the mouse.
        onMouseDown={(event) => event.preventDefault()}
        onClick={toggle}
        className="press absolute inset-y-0 right-2 my-auto grid size-9 place-items-center rounded-full text-tertiary transition-colors hover:bg-fill-2 hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {shown ? <EyeOffIcon className="size-[18px]" /> : <EyeIcon className="size-[18px]" />}
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
      className="press mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-medium text-primary-foreground transition-opacity focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-70"
    >
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

const responseSchema = z.object({
  next: z.string().optional(),
  notice: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

// Server refusals that belong to one field, so the message shows under it.
const CODE_FIELD: Partial<Record<string, string>> = {
  codigo: "accessCode",
  "email-em-uso": "email",
  "sem-convite": "email",
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
 * A success that signs nobody in (a reset link sent) leaves its `notice` for the page to show.
 */
export function useAuthForm(
  endpoint: string,
  schema: z.ZodType,
  initialError: LoginErrorCode | undefined,
  initialNotice: string | null = null,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? LOGIN_ERRORS[initialError] : null,
  );
  const [notice, setNotice] = useState<string | null>(initialNotice);
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
      if (response.ok && body.notice) {
        setPending(false);
        setNotice(body.notice);
        return;
      }
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

  return { pending, error, notice, fields, onSubmit, onBlurCapture };
}

/** The form-level error (or a notice like Caps Lock), above the submit button when present. */
export function FormError({ message, notice }: { message: string | null; notice?: string | null }) {
  const text = message ?? notice;
  return (
    <p
      role="alert"
      className={cn(
        "-mb-1 text-center text-[14px] leading-snug empty:hidden",
        message ? "text-red" : "text-tertiary",
      )}
    >
      {text}
    </p>
  );
}
