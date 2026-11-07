import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotificationGroup, NotificationItem, NotificationScope } from "@/lib/notifications";
import { NotificationRow } from "./notification-row";
import { SegmentedControl } from "./segmented-control";

const FILTER_OPTIONS = [
  { value: "mine", label: "Meus leads" },
  { value: "all", label: "Todos" },
] as const;

function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center gap-2.5 px-8 pt-10 pb-12 text-center">
      <span className="grid size-13 place-items-center rounded-full bg-fill-2 text-muted-foreground">
        <BellIcon aria-hidden className="size-6" strokeWidth={1.8} />
      </span>
      <p className="text-base font-semibold">Nada novo por aqui</p>
      <p className="max-w-[300px] text-sm leading-snug text-muted-foreground">
        Avisamos quando um lead responder, um retorno vencer, uma reunião chegar ou uma busca
        terminar.
      </p>
    </div>
  );
}

function GroupHeader({
  group,
  onMarkRead,
}: {
  group: NotificationGroup;
  onMarkRead: (keys: string[]) => void;
}) {
  const unread = group.unreadKeys.length;
  return (
    <div className="flex h-8 items-center gap-2 pr-3 pl-5">
      <h3 className="text-[13px] font-semibold text-muted-foreground">{group.label}</h3>
      {unread > 0 ? (
        <span className="text-[13px] text-tertiary tabular-nums">
          {unread === 1 ? "1 nova" : `${unread} novas`}
        </span>
      ) : null}
      <span className="flex-1" />
      {unread > 0 ? (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onMarkRead(group.unreadKeys)}
          aria-label={`Marcar ${group.label} como lidas`}
        >
          Marcar lidas
        </Button>
      ) : null}
    </div>
  );
}

/** The panel's content: the Meus/Todos filter, then one section per category. */
export function NotificationList({
  groups,
  now,
  filter,
  onFilterChange,
  onOpen,
  onMarkRead,
}: {
  groups: NotificationGroup[];
  now: number;
  filter: NotificationScope;
  onFilterChange: (scope: NotificationScope) => void;
  onOpen: (item: NotificationItem) => void;
  onMarkRead: (keys: string[]) => void;
}) {
  return (
    <>
      <SegmentedControl
        label="De quais leads"
        value={filter}
        options={FILTER_OPTIONS}
        onChange={onFilterChange}
        className="mx-5 mb-2"
      />
      {groups.length === 0 ? <EmptyNotifications /> : null}
      {groups.map((group) => (
        <section key={group.category} aria-label={group.label} className="flex flex-col pt-2 pb-1">
          <GroupHeader group={group} onMarkRead={onMarkRead} />
          <ul className="flex flex-col">
            {group.items.map((item) => (
              <li key={item.key}>
                <NotificationRow item={item} now={now} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length > 0 ? (
        <p className="px-5 pt-3 pb-5 text-[12.5px] text-tertiary">Mostrando os últimos 30 dias.</p>
      ) : null}
    </>
  );
}
