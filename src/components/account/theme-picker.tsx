import { useRadioArrows } from "@/hooks/use-radio-arrows";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/lib/theme";

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Escuro" },
  { value: "light", label: "Claro" },
];

// A small picture of the app in each theme: sidebar, and two cards on the window.
const THUMB: Record<Theme, { window: string; side: string; card: string }> = {
  dark: { window: "bg-[#141416]", side: "bg-[#1c1c1f]", card: "bg-[#232327]" },
  light: { window: "bg-[#ebebef]", side: "bg-[#f5f5f8]", card: "bg-white" },
};

/**
 * The theme as two thumbnails to pick from; the change applies at once. A radio group: Tab
 * reaches the chosen one, the arrow keys move and pick.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const arrows = useRadioArrows(THEMES, (option) => setTheme(option.value));

  return (
    <div role="radiogroup" aria-label="Tema" className="flex flex-wrap gap-3">
      {THEMES.map((option, index) => {
        const checked = theme === option.value;
        const colors = THUMB[option.value];
        return (
          <button
            key={option.value}
            ref={arrows.register(index)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onKeyDown={(event) => arrows.onKeyDown(event, index)}
            onClick={() => setTheme(option.value)}
            className={cn(
              "grid justify-items-start gap-2 rounded-[14px] border p-2 text-sm font-medium outline-none transition-colors duration-150 hover:bg-fill-2 focus-visible:ring-2 focus-visible:ring-ring",
              checked ? "border-primary ring-1 ring-primary ring-inset" : "border-border",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "grid h-20 w-33 grid-cols-[22px_1fr] grid-rows-2 gap-[5px] rounded-[9px] p-[7px]",
                colors.window,
              )}
            >
              <i className={cn("row-span-2 rounded-[5px]", colors.side)} />
              <b className={cn("rounded-[5px]", colors.card)} />
              <b className={cn("rounded-[5px]", colors.card)} />
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
