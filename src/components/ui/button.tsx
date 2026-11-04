import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Capsule buttons (macOS): instant press feedback, spring easing.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[transform,background-color,box-shadow,color,filter] duration-150 ease-spring outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary font-semibold text-primary-foreground hover:brightness-110",
        outline:
          "bg-fill text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] hover:bg-[rgb(118_118_128/0.28)] aria-expanded:bg-[rgb(118_118_128/0.28)] [&_svg]:text-muted-foreground",
        secondary:
          "bg-fill text-foreground hover:bg-[rgb(118_118_128/0.28)] aria-expanded:bg-[rgb(118_118_128/0.28)]",
        ghost:
          "text-muted-foreground hover:bg-fill-2 hover:text-foreground aria-expanded:bg-fill-2 aria-expanded:text-foreground",
        destructive:
          "bg-fill text-red hover:bg-red/15 focus-visible:ring-red/30",
        link: "text-blue underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        // The small sizes get an invisible hit area on touch screens (40px+), so a 24-28px button
        // stays easy to tap without making the desktop layout bigger.
        xs: "relative h-6 gap-1 px-2.5 text-xs pointer-coarse:after:absolute pointer-coarse:after:-inset-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "relative h-7 gap-1.5 px-3 text-[0.78rem] pointer-coarse:after:absolute pointer-coarse:after:-inset-y-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "relative size-8 pointer-coarse:after:absolute pointer-coarse:after:-inset-1 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "relative size-6 pointer-coarse:after:absolute pointer-coarse:after:-inset-2 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "relative size-7 pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
