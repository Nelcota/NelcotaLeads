import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One row of a settings card: the label on the left, the value in the middle and at most one
 * action on the right. Rows split by a hairline; `align="top"` for rows with a preview.
 */
export function SettingsRow({
  label,
  action,
  align = "center",
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  label?: ReactNode;
  action?: ReactNode;
  align?: "center" | "top";
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "settings-row flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-2 sm:flex-nowrap",
        align === "top" && "items-start py-4",
        className,
      )}
      {...props}
    >
      {label ? <span className="w-28 shrink-0 text-muted-foreground sm:w-44">{label}</span> : null}
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
