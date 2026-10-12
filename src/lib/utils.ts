// Official shadcn/ui class merger (drop-in for clsx + tailwind-merge).
export { cn } from "cn";

/** Returns the URL only when it is an absolute http(s) link, so it is safe to use as an href. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
