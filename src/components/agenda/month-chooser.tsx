import { ChevronLeftIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
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
        <Button variant="ghost" size="icon-sm" aria-label="Voltar aos dias" onClick={onBack}>
          <ChevronLeftIcon />
        </Button>
        <span className="text-sm font-semibold">Escolha o mês</span>
      </div>
      <div role="radiogroup" aria-label="Ano" className="grid grid-cols-4 gap-1">
        {years.map((value) => (
          <ChoicePill
            key={value}
            size="sm"
            role="radio"
            aria-checked={value === year}
            selected={value === year}
            onClick={() => onYear(value)}
          >
            {value}
          </ChoicePill>
        ))}
      </div>
      <div role="group" aria-label={`Meses de ${year}`} className="grid grid-cols-3 gap-1">
        {MONTHS.map((name, index) => {
          const first = `${year}-${String(index + 1).padStart(2, "0")}-01`;
          const chosen = index === monthIndex(month);
          const current = first.slice(0, 7) === today.slice(0, 7);
          return (
            <ChoicePill
              key={name}
              aria-pressed={chosen}
              aria-current={current ? "date" : undefined}
              aria-label={`${capitalize(name)} de ${year}`}
              selected={chosen}
              onClick={() => onMonth(first)}
              className={cn(current && !chosen && "font-bold")}
            >
              {capitalize(name.slice(0, 3))}
            </ChoicePill>
          );
        })}
      </div>
    </div>
  );
}
