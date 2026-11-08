import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OVERVIEW_PERIODS,
  overviewPeriodSchema,
  PERIOD_OPTION_LABELS,
  type OverviewPeriod,
} from "@/lib/period";

/** Separate pills on the page background, like Nelcota PRs, instead of a gray track. */
const LIST_CLASS = "gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto";

/** 44px outlined pills; the chosen period in solid blue, like the active sidebar row. */
const PILL_CLASS =
  "h-11 flex-none rounded-full border-border px-4 hover:bg-fill-2 data-active:border-transparent data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:hover:bg-primary dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground group-data-[variant=default]/tabs-list:data-active:shadow-none";

/** "7 dias / 30 dias / Este mês": the window the metrics below are counted in. */
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
          <TabsTrigger key={period} value={period} className={PILL_CLASS}>
            {PERIOD_OPTION_LABELS[period]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
