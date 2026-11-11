import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * The one button of the app (2026-11-08 standard): a solid pill with a 1px outline, Urbanist
 * 14px, the same press feedback everywhere and the app's neutral keyboard focus ring (the
 * global `:focus-visible` outline in styles.css, never the blue accent).
 *
 * Roles: `default` primary (one per area), `outline` secondary, `ghost` quiet (Cancelar,
 * Voltar), `destructive` danger, `link` only to open another page.
 * Heights: `default` 40px (page bars, filters, tabs), `sm` 32px (cards, tables, chips in
 * forms), `lg` 48px (sign-in only); icon-only buttons are round in the same three sizes.
 *
 * Do not pass a `className` that changes height, color, border or radius: pick a role and a size.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full border bg-clip-padding text-sm font-medium whitespace-nowrap transition-[transform,background-color,border-color,color,filter] duration-150 ease-spring select-none active:not-aria-[haspopup]:scale-[0.97] motion-reduce:active:not-aria-[haspopup]:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-red [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-white/20 bg-primary font-semibold text-primary-foreground hover:brightness-110",
        outline:
          "border-border text-foreground hover:bg-fill-2 aria-expanded:bg-fill-2",
        ghost:
          "border-transparent text-muted-foreground hover:bg-fill-2 hover:text-foreground aria-expanded:bg-fill-2 aria-expanded:text-foreground",
        destructive: "border-border text-red hover:bg-red/10",
        link: "border-border text-blue underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 pointer-coarse:touch-target [&_svg:not([class*='size-'])]:size-4",
        // Sizes under 44px get an invisible hit area on touch screens (44px, UX audit T6), so a
        // small button stays easy to tap without making the desktop layout bigger.
        sm: "h-8 gap-1.5 px-3 pointer-coarse:touch-target [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 text-base [&_svg:not([class*='size-'])]:size-[18px]",
        icon: "size-10 pointer-coarse:touch-target [&_svg:not([class*='size-'])]:size-4",
        "icon-sm":
          "size-8 pointer-coarse:touch-target [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-[18px]",
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
