import * as React from "react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"

type ChoicePillProps = React.ComponentProps<"button"> & {
  /** On: a primary button. Off: a secondary (outlined) button. */
  selected: boolean
  /** Optional count after the label ("4", "3 atrasados"); hidden when empty. */
  count?: string
  /** `default` 40px for page bars, tabs and filters; `sm` 32px for cards and forms. */
  size?: "default" | "sm"
}

/**
 * One option of a one-of-a-few choice (Leads tabs, period, agenda view, chips in forms).
 * The caller gives the semantics (`role="tab"` + `aria-selected`, or `role="radio"` +
 * `aria-checked`); `className` is for layout only (flex, width), never for color or height.
 */
function ChoicePill({
  selected,
  count,
  size = "default",
  type = "button",
  className,
  children,
  ...props
}: ChoicePillProps) {
  return (
    <button
      type={type}
      data-slot="choice-pill"
      data-selected={selected}
      className={cn(buttonVariants({ variant: selected ? "default" : "outline", size }), className)}
      {...props}
    >
      {children}
      {count ? (
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            selected ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  )
}

export { ChoicePill }
