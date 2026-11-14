import { useSettingsSummary } from "@/hooks/use-settings-summary";
import { SummaryCards } from "./summary-cards";
import { UsageBlock } from "./usage-block";

/** Resumo: one card per area with its live state, then today's and the month's usage. */
export function SummaryTab() {
  const summary = useSettingsSummary();
  return (
    <div className="grid gap-6">
      <SummaryCards summary={summary} />
      <div>
        <UsageBlock usage={summary.usage} system={summary.system} />
      </div>
    </div>
  );
}
