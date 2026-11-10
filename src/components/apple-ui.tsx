import type { LucideIcon } from "lucide-react";
import { ArrowUpRightIcon, ChevronRightIcon, InfoIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The app's tooltip on hover and keyboard focus, in place of the native `title`. The trigger
 * keeps its own `aria-label`; needs the TooltipProvider of the AppShell.
 */
export function Hint({
  label,
  side,
  children,
}: {
  label: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
  children: ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Why a control is disabled, as a tooltip. A disabled button gets no pointer or focus events,
 * so it is wrapped in a focusable span that carries the tooltip. Without a reason, the child
 * is rendered as is.
 */
export function DisabledReason({
  reason,
  side,
  className,
  children,
}: {
  reason: string | null | undefined | false;
  side?: ComponentProps<typeof TooltipContent>["side"];
  className?: string;
  children: ReactElement;
}) {
  if (!reason) return children;
  return (
    <Hint label={reason} side={side}>
      <span
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reaches the tooltip by keyboard
        tabIndex={0}
        className={cn(
          // The disabled control lets the pointer through, so hovering it shows the reason.
          "inline-flex rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40 [&>:disabled]:pointer-events-none",
          className,
        )}
      >
        {children}
      </span>
    </Hint>
  );
}

/**
 * A link that opens in a new tab: ↗ after the text, "abre em nova aba" for screen readers and
 * `rel="noopener noreferrer"`. `indicator={false}` drops the arrow where the link is an icon.
 */
export function ExternalLink({
  children,
  indicator = true,
  ...props
}: Omit<ComponentProps<"a">, "target" | "rel"> & { indicator?: boolean }) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      {indicator ? <ExternalMark /> : null}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

/** The ↗ of ExternalLink, for links that place it themselves (`indicator={false}`). */
export function ExternalMark() {
  return <ArrowUpRightIcon aria-hidden className="size-3 shrink-0" />;
}

/** The system colors; each one carries a status meaning across the app. */
export type Tone = "green" | "orange" | "red" | "blue" | "purple" | "teal" | "pink" | "gray";

const TONE_VAR: Record<Tone, string> = {
  green: "var(--green)",
  orange: "var(--orange)",
  red: "var(--red)",
  blue: "var(--blue)",
  purple: "var(--purple)",
  teal: "var(--teal)",
  pink: "var(--pink)",
  gray: "var(--gray)",
};

export const TONE_TEXT: Record<Tone, string> = {
  green: "text-green",
  orange: "text-orange",
  red: "text-red",
  blue: "text-blue",
  purple: "text-purple",
  teal: "text-teal",
  pink: "text-pink",
  gray: "text-gray",
};

export function toneVar(tone: Tone) {
  return TONE_VAR[tone];
}

/** Line icon in the tone's color, no tile behind it; the box keeps `size` so layouts hold. */
export function IconTile({
  icon: Icon,
  tone,
  size = 22,
  className,
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: number;
  /** Kept for callers; the bare icon has no shape to round. */
  round?: boolean;
  className?: string;
}) {
  const glyph = size >= 48 ? Math.round(size * 0.5) : 16;
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center", TONE_TEXT[tone], className)}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: glyph, height: glyph }} strokeWidth={2} />
    </span>
  );
}

const AVATAR_TONES: Tone[] = ["blue", "green", "orange", "purple", "pink", "teal"];

function avatarTone(name: string): Tone {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length] ?? "blue";
}

function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]?.[0]}${words[1]?.[0]}` : (words[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase() || "?";
}

/** Initials avatar; the color is stable per name. Shows `src` instead when there is a photo. */
export function Avatar({
  name,
  src,
  size = 32,
  square = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  square?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        className={cn(
          "shrink-0 object-cover",
          square ? "rounded-[14px]" : "rounded-full",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  const tone = avatarTone(name);
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
        square ? "rounded-[14px]" : "rounded-full",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.34)),
        background: TONE_VAR[tone],
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Apple Watch–style ring; fills from zero when it mounts. */
export function ProgressRing({
  value,
  tone,
  size = 34,
  thickness = 4.5,
  track = "var(--card)",
  children,
  className,
}: {
  value: number;
  tone: Tone;
  size?: number;
  thickness?: number;
  track?: string;
  children?: ReactNode;
  className?: string;
}) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <span
      className={cn("ring-fill relative grid shrink-0 place-items-center rounded-full", className)}
      style={{
        "--p": percent,
        width: size,
        height: size,
        background: `conic-gradient(${TONE_VAR[tone]} calc(var(--p) * 1%), rgb(127 127 127 / 0.18) 0)`,
      }}
    >
      <span
        className="absolute rounded-full"
        style={{ inset: thickness, background: track }}
        aria-hidden
      />
      {children ? <span className="relative">{children}</span> : null}
    </span>
  );
}

/** Clickable card: a quiet outline on hover, nothing that follows the pointer. */
export function Lift({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("lift", className)} {...props} />;
}

/** Section title above a grouped list (Settings style). */
export function SectionHeader({
  title,
  tone,
  count,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  tone?: Tone;
  count?: number;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-1.5 pb-2", className)}>
      <h2 className={cn("text-lg font-medium tracking-[-0.015em]", tone && TONE_TEXT[tone])}>
        {title}
      </h2>
      {count !== undefined && tone ? (
        <span
          className={cn("rounded-full px-2 py-px text-xs font-medium", TONE_TEXT[tone])}
          style={{ background: `color-mix(in srgb, ${TONE_VAR[tone]} 16%, transparent)` }}
        >
          {count}
        </span>
      ) : null}
      {hint ? <span className="text-sm font-light text-muted-foreground">{hint}</span> : null}
      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
  );
}

/** One row of a grouped list: leading visual, title, colored subtitle, trailing accessory. */
export function GroupedRow({
  lead,
  title,
  subtitle,
  subtitleTone,
  trailing,
  chevron = false,
  inset = 60,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  lead?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  subtitleTone?: Tone;
  trailing?: ReactNode;
  chevron?: boolean;
  inset?: number;
}) {
  return (
    <div
      className={cn(
        "grouped-row row-hover flex min-h-[54px] items-center gap-3 py-2 pr-3.5 pl-4 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03]",
        className,
      )}
      style={{ "--inset": `${inset}px` }}
      {...props}
    >
      {lead ? <span className="shrink-0">{lead}</span> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle ? (
          <div
            className={cn(
              "truncate text-[14px]",
              subtitleTone
                ? cn("font-medium", TONE_TEXT[subtitleTone])
                : "font-light text-muted-foreground",
            )}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {trailing}
      {chevron ? <ChevronRightIcon className="row-chev size-3.5 shrink-0 text-quaternary" /> : null}
    </div>
  );
}

/** Label/value row for property lists (Contacts style). */
export function PropertyRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grouped-row flex min-h-[42px] items-center justify-between gap-4 px-4 py-2 [--inset:16px]">
      <span className="shrink-0 font-light text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

/** Bar floating at the bottom of the content panel (selection, unsaved changes). */
export function FloatingBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className="pointer-events-none sticky bottom-[max(12px,env(safe-area-inset-bottom))] z-20 flex justify-center sm:bottom-5">
      <div
        className={cn(
          "rise pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] py-2 pr-2 pl-4 max-sm:w-full sm:rounded-full sm:py-1.5 sm:pr-1.5",
          "bg-[#2c2c30] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),inset_0_0_0_1px_rgb(255_255_255/0.07),0_18px_40px_rgb(0_0_0/0.55)]",
          "[:root:not(.dark)_&]:bg-white [:root:not(.dark)_&]:text-foreground [:root:not(.dark)_&]:shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_rgb(0_0_0/0.14)]",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/** Empty, error and not-found states. */
export function EmptyState({
  icon,
  tone = "gray",
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <IconTile icon={icon} tone={tone} size={56} className="rounded-[15px]!" />
      <div className="grid gap-1">
        <p className="text-lg font-medium tracking-[-0.015em]">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm font-light text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Autosave feedback next to an edited draft; nothing until the first edit. */
export function SaveStatus({
  state,
  className,
}: {
  state: "idle" | "saving" | "saved" | "error";
  className?: string;
}) {
  if (state === "idle") return null;
  return (
    <span
      aria-live="polite"
      className={cn(
        "text-xs font-light",
        state === "error" ? "text-red" : "text-tertiary",
        className,
      )}
    >
      {state === "saving"
        ? "Salvando…"
        : state === "saved"
          ? "Rascunho salvo"
          : "Rascunho não salvo"}
    </span>
  );
}

/** A keyboard key, as in the help and next to the lead sheet's arrows. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-grid h-[20px] min-w-[20px] place-items-center rounded-[5px] bg-fill-2 px-1.5 text-[12px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A small ⓘ next to a concept (nota, nota mínima, modo automático…) with its explanation in a
 * tooltip: on hover, keyboard focus, and on tap (touch screens have no hover).
 */
export function InfoTip({
  children,
  side,
  className,
}: {
  children: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Mais informações"
          onClick={(event) => {
            // Radix closes a tooltip on click; a tap opens it instead (it closes on blur, Esc or
            // a tap elsewhere). Not a toggle: a hover may already have opened it.
            event.preventDefault();
            setOpen(true);
          }}
          className={cn(
            "-m-[9px] inline-grid size-8 shrink-0 place-items-center rounded-full align-middle text-tertiary transition-colors outline-none hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
          )}
        >
          <InfoIcon aria-hidden className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="max-w-64 font-normal leading-snug">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
