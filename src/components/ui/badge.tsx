import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Tinted capsule: the status color goes on the background (16%) and on the text.
const badgeVariants = cva(
  "group/badge inline-flex h-[21px] w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 [&>svg]:pointer-events-none [&>svg]:size-3! [&>svg]:stroke-[2.4]",
  {
    variants: {
      variant: {
        default: "bg-primary/16 text-primary",
        secondary: "bg-fill-2 text-muted-foreground",
        outline: "bg-fill-2 text-muted-foreground",
        destructive: "bg-red/16 text-red",
        ghost: "text-muted-foreground hover:bg-fill-2",
        link: "text-blue underline-offset-4 hover:underline",
        green: "bg-green/16 text-green",
        orange: "bg-orange/16 text-orange",
        red: "bg-red/16 text-red",
        blue: "bg-blue/16 text-blue",
        purple: "bg-purple/16 text-purple",
        teal: "bg-teal/16 text-teal",
        pink: "bg-pink/16 text-pink",
        gray: "bg-gray/16 text-gray",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; dot?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot ? (
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
