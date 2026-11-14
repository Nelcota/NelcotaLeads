import { DiscardChangesDialog } from "@/components/leave-guard";
import { useAutomationTab } from "@/hooks/use-automation-tab";
import { AutomationSwitches } from "./automation-switches";
import { AutomationTimeline, timelineSteps } from "./automation-timeline";
import { DailySearchFields } from "./daily-search-fields";

/** Automação: the three switches and the daily search on the left, "Num dia comum" beside them. */
export function AutomationTab() {
  const { state, lines, timeline } = useAutomationTab();
  return (
    <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
      <form
        id="piloto"
        noValidate
        className="grid min-w-0 flex-[999_1_420px] scroll-mt-4 gap-7"
        onSubmit={(event) => void state.submit(event)}
      >
        <AutomationSwitches
          control={state.form.control}
          status={lines}
          pending={state.switchPending}
          onFlip={state.flip}
        />
        <DailySearchFields state={state} />
      </form>
      <AutomationTimeline steps={timelineSteps(timeline)} />
      <DiscardChangesDialog
        open={state.confirmDiscard}
        description="A busca diária volta a ser como está salva."
        onCancel={state.cancelDiscard}
        onDiscard={state.discard}
      />
    </div>
  );
}
