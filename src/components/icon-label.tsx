import type { LucideIcon } from "lucide-react";

/** A muted label led by a bare line icon, for property rows. */
export function IconLabel({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} />
      {text}
    </span>
  );
}
