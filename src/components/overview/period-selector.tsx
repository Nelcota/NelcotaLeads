import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  OVERVIEW_PERIODS,
  overviewPeriodSchema,
  PERIOD_OPTION_LABELS,
  type OverviewPeriod,
} from "@/lib/period";

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
      <TabsList aria-label="Período das métricas">
        {OVERVIEW_PERIODS.map((period) => (
          <TabsTrigger key={period} value={period}>
            {PERIOD_OPTION_LABELS[period]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
