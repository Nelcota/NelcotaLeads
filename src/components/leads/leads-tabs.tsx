import type { LeadCounts } from "@/server/leads-query";
import { LEAD_VIEW_LABELS, type LeadView } from "@/lib/schemas";
import { ChoicePill } from "@/components/ui/choice-pill";

const WORK_VIEWS: LeadView[] = ["todo", "followup", "waiting", "talking"];
const ARCHIVE_VIEWS: LeadView[] = ["closed", "discarded", "all"];

/** "3", "3 · 1 atrasado", or nothing for an empty queue. */
function countText(view: LeadView, counts: LeadCounts | undefined): string {
  const count = counts?.byView[view] ?? 0;
  if (count === 0) return "";
  const overdue = view === "followup" ? (counts?.overdue ?? 0) : 0;
  const late = `${overdue} ${overdue === 1 ? "atrasado" : "atrasados"}`;
  // All of them late: "3 atrasados" says it once.
  if (overdue > 0 && overdue === count) return late;
  if (overdue > 0) return `${count} · ${late}`;
  return String(count);
}

function TabPill({
  view,
  active,
  counts,
  onSelect,
}: {
  view: LeadView;
  active: boolean;
  counts: LeadCounts | undefined;
  onSelect: (view: LeadView) => void;
}) {
  return (
    <ChoicePill
      role="tab"
      aria-selected={active}
      selected={active}
      count={countText(view, counts)}
      onClick={() => onSelect(view)}
    >
      {LEAD_VIEW_LABELS[view]}
    </ChoicePill>
  );
}

/**
 * The stage tabs as pills: the work in progress first, then the archive after a gap. The
 * active one is solid blue; empty counts are hidden.
 */
export function LeadsTabs({
  view,
  counts,
  onSelect,
}: {
  view: LeadView;
  counts: LeadCounts | undefined;
  onSelect: (view: LeadView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Etapas"
      className="no-scrollbar -mx-4 flex items-center gap-x-4 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:gap-y-2 lg:overflow-visible lg:px-0"
    >
      <div className="flex shrink-0 gap-1.5">
        {WORK_VIEWS.map((item) => (
          <TabPill
            key={item}
            view={item}
            active={view === item}
            counts={counts}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {ARCHIVE_VIEWS.map((item) => (
          <TabPill
            key={item}
            view={item}
            active={view === item}
            counts={counts}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
