import type { ComponentType, ReactNode } from "react";
import { TONE_TEXT, type Tone } from "@/components/apple-ui";
import { cn } from "@/lib/utils";

/** A one-line notice in the panel: a line icon in the tone, then neutral text (badge standard). */
export function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-sm leading-5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])} strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}
