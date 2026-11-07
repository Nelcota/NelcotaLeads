import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthIndex, MONTHS } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The month and year view: a strip of four years and the twelve months below it. */
export function MonthChooser({
  month,
  today,
  onBack,
  onYear,
  onMonth,
}: {
  month: string;
  today: string;
  onBack: () => void;
  onYear: (year: string) => void;
  onMonth: (firstDay: string) => void;
}) {
  const thisYear = Number(today.slice(0, 4));
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(String);
  const year = month.slice(0, 4);
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Voltar aos dias" onClick={onBack}>
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-semibold">Escolha o mês</span>
      </div>
      <div
        role="radiogroup"
        aria-label="Ano"
        className="grid grid-cols-4 rounded-full bg-fill-2 p-[3px]"
      >
        {years.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === year}
            onClick={() => onYear(value)}
            className={cn(
              "h-[30px] rounded-full text-[14px] transition-colors",
              value === year
                ? "bg-primary font-semibold text-primary-foreground"
                : "font-medium hover:bg-fill",
            )}
          >
            {value}
          </button>
        ))}
      </div>
      <div role="group" aria-label={`Meses de ${year}`} className="grid grid-cols-3 gap-1">
        {MONTHS.map((name, index) => {
          const first = `${year}-${String(index + 1).padStart(2, "0")}-01`;
          const chosen = index === monthIndex(month);
          const current = first.slice(0, 7) === today.slice(0, 7);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={chosen}
              aria-label={`${capitalize(name)} de ${year}`}
              onClick={() => onMonth(first)}
              className={cn(
                "h-11 rounded-full text-[14px] transition-colors",
                chosen ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-fill-2",
                current && !chosen
                  ? "font-bold text-primary ring-[1.5px] ring-primary ring-inset"
                  : "",
              )}
            >
              {capitalize(name.slice(0, 3))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
