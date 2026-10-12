import "react";

// Lets `style` set CSS custom properties (e.g. `{ "--tone": "var(--green)" }`) without casts.
declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
