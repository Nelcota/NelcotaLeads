import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** A round button that switches between the dark and light themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Usar tema claro" : "Usar tema escuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "press grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-[inset_0_0_0_1px_var(--border)] transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
        className,
      )}
    >
      {dark ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
    </button>
  );
}
