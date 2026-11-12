import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[10px] px-3 py-2.5 text-base leading-relaxed transition-[box-shadow] outline-none bg-black/[0.03] dark:bg-black/25 shadow-[inset_0_0_0_1px_var(--input)] border-0 placeholder:text-tertiary focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
