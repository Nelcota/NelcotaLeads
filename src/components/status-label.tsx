import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE_TEXT, type Tone } from "@/components/apple-ui";
import { cn } from "@/lib/utils";

/**
 * A status badge in the app's standard (roadmap, 2026-11-05): a line icon in the status color
 * followed by neutral text. No pill, no tinted fill, no dot.
 */
export function StatusLabel({
  icon: Icon,
  tone,
  className,
  children,
}: {
  icon: LucideIcon;
  tone: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={2.2} className={cn("size-3.5 shrink-0", TONE_TEXT[tone])} />
      {children}
    </span>
  );
}
