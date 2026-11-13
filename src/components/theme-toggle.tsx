import { MoonIcon, SunIcon } from "@/components/icons";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

/** A round button that switches between the dark and light themes. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Usar tema claro" : "Usar tema escuro";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={className}
    >
      {dark ? <SunIcon className="size-[18px]" /> : <MoonIcon className="size-[18px]" />}
    </Button>
  );
}
