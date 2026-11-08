import { Tabs as TabsPrimitive } from "radix-ui";
import { ChoicePill } from "@/components/ui/choice-pill";
import { Tabs, TabsList } from "@/components/ui/tabs";
import {
  OVERVIEW_PERIODS,
  overviewPeriodSchema,
  PERIOD_OPTION_LABELS,
  type OverviewPeriod,
} from "@/lib/period";

/** Separate pills on the page background, like Nelcota PRs, instead of a gray track. */
const LIST_CLASS = "gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto";

/**
 * "7 dias / 30 dias / Este mês": the window the metrics below are counted in. Radix keeps
 * the tab semantics and arrow keys; each option is the app's standard choice pill.
 */
export function PeriodSelector({
  value,
  onChange,
}: {
  value: OverviewPeriod;
  onChange: (period: OverviewPeriod) => void;
}) {
  const select = (next: string) => {
    const parsed = overviewPeriodSchema.safeParse(next);
    if (parsed.success) onChange(parsed.data);
  };
  return (
    <Tabs value={value} onValueChange={select}>
      <TabsList aria-label="Período das métricas" className={LIST_CLASS}>
        {OVERVIEW_PERIODS.map((period) => (
          <TabsPrimitive.Trigger key={period} value={period} asChild>
            <ChoicePill selected={period === value}>{PERIOD_OPTION_LABELS[period]}</ChoicePill>
          </TabsPrimitive.Trigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
