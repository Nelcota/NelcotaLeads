import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SETTINGS_HAIRLINE } from "./surface";

/**
 * One line of values inside a section: an optional icon, the label (and a subline) and the value
 * on the right. Lines split by a hairline. The first line has no top padding, so its text lines
 * up with the section title on the left.
 */
export function SettingsLine({
  icon,
  label,
  sub,
  value,
  className,
}: {
  icon?: ReactNode;
  label: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t py-3.5 first:border-t-0 first:pt-0",
        SETTINGS_HAIRLINE,
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <div>{label}</div>
        {sub ? <div className="text-sm text-muted-foreground">{sub}</div> : null}
      </div>
      {value !== undefined ? (
        <div className="shrink-0 text-right text-muted-foreground tabular-nums">{value}</div>
      ) : null}
    </div>
  );
}
