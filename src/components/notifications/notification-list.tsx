import { BellIcon } from "lucide-react";
import type { NotificationItem, NotificationScope, NotificationSection } from "@/lib/notifications";
import { NotificationRow } from "./notification-row";
import { SegmentedControl } from "./segmented-control";

const FILTER_OPTIONS = [
  { value: "mine", label: "Meus leads" },
  { value: "all", label: "Todos" },
] as const;

function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center gap-2 px-7 pt-9 pb-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-fill-2 text-muted-foreground">
        <BellIcon aria-hidden className="size-5" strokeWidth={1.8} />
      </span>
      <p className="text-[15px] font-semibold">Nada novo por aqui</p>
      <p className="max-w-[260px] text-[13px] leading-snug text-muted-foreground">
        Avisamos quando um lead responder, um retorno vencer, uma reunião chegar ou uma busca
        terminar.
      </p>
    </div>
  );
}

/** The panel's content: the Meus/Todos filter, then one list by time, Novas above Anteriores. */
export function NotificationList({
  sections,
  now,
  filter,
  onFilterChange,
  onOpen,
  onDismiss,
}: {
  sections: NotificationSection[];
  now: number;
  filter: NotificationScope;
  onFilterChange: (scope: NotificationScope) => void;
  onOpen: (item: NotificationItem) => void;
  onDismiss: (item: NotificationItem) => void;
}) {
  return (
    <>
      <SegmentedControl
        label="De quais leads"
        value={filter}
        options={FILTER_OPTIONS}
        onChange={onFilterChange}
        size="sm"
        className="mx-4 mb-1.5"
      />
      {sections.length === 0 ? <EmptyNotifications /> : null}
      {sections.map((section) => (
        <section key={section.label} aria-label={section.label} className="flex flex-col py-1">
          <h3 className="px-4 pt-1.5 pb-1 text-xs font-semibold text-tertiary">{section.label}</h3>
          <ul className="flex flex-col">
            {section.items.map((item) => (
              <li key={item.key}>
                <NotificationRow item={item} now={now} onOpen={onOpen} onDismiss={onDismiss} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div aria-hidden className="h-2 shrink-0" />
    </>
  );
}
