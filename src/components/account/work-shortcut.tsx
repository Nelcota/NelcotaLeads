import { Link, type LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One block of "Seu trabalho": an icon, the name and a line under it (usually the count). Blue
 * icon and line while it asks for action.
 */
export function WorkShortcut({
  icon: Icon,
  label,
  detail,
  urgent = false,
  ...link
}: Pick<LinkProps, "to" | "search"> & {
  icon: LucideIcon;
  label: string;
  /** Null while the count is unknown: no line under the name. */
  detail: string | null;
  urgent?: boolean;
}) {
  return (
    <Link
      {...link}
      className="settings-tile grid content-start gap-3 rounded-2xl p-4 outline-none transition-[background-color,transform] duration-150 hover:bg-fill-2 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <Icon aria-hidden className={cn("size-5", urgent ? "text-blue" : "text-muted-foreground")} />
      <span className="grid gap-0.5">
        <span className="font-medium">{label}</span>
        {detail ? (
          <span className={cn("text-sm", urgent ? "text-blue" : "text-muted-foreground")}>
            {detail}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
