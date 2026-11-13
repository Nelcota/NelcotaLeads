import type { ReactNode } from "react";
import { TONE_TEXT, type Tone } from "@/components/apple-ui";
import type { IconComponent } from "@/components/icons";
import { cn } from "@/lib/utils";

/** A one-line notice in the panel: a line icon in the tone, then neutral text (badge standard). */
export function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: IconComponent;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 text-sm leading-5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])} />
      <span>{children}</span>
    </p>
  );
}
