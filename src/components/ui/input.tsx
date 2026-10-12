import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-[10px] px-3 py-1 text-base transition-[box-shadow] outline-none bg-black/[0.03] dark:bg-black/25 shadow-[inset_0_0_0_1px_var(--input)] border-0 placeholder:text-tertiary focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] focus-visible:ring-3 focus-visible:ring-ring/30 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground  disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm  dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
