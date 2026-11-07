import { ChevronLeftIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import type { NotificationCenter as Center } from "@/hooks/use-notifications";
import type { NotificationItem } from "@/lib/notifications";
import { NotificationList } from "./notification-list";
import { NotificationPrefsForm } from "./notification-prefs";

type View = "list" | "prefs";

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" size="icon-lg" onClick={onClose} aria-label="Fechar notificações">
      <XIcon aria-hidden />
    </Button>
  );
}

/**
 * The panel inside the bell's popover (desktop) or full-screen sheet (phone): the list grouped
 * by category, or the preferences. `Heading` is the title element the container needs (the
 * sheet's accessible title on the phone, a plain heading in the popover).
 */
export function NotificationCenterPanel({
  center,
  Heading,
  showClose,
  onClose,
}: {
  center: Center;
  Heading: ComponentType<{ children: ReactNode }>;
  showClose: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("list");
  const allUnread = center.groups.flatMap((group) => group.unreadKeys);

  const open = (item: NotificationItem) => {
    if (item.unread) center.markRead([item.key]);
    onClose();
  };

  if (view === "prefs") {
    return (
      <>
        <div className="flex items-center gap-1.5 pt-3.5 pr-3 pb-2 pl-2.5">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setView("list")}
            aria-label="Voltar para notificações"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <div className="flex-1">
            <Heading>Preferências</Heading>
          </div>
          {showClose ? <CloseButton onClose={onClose} /> : null}
        </div>
        <NotificationPrefsForm prefs={center.data.prefs} onChange={center.savePrefs} />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 pt-4 pr-3 pb-2 pl-5">
        <div className="flex-1">
          <Heading>Notificações</Heading>
        </div>
        {allUnread.length > 0 ? (
          <Button variant="link" size="sm" onClick={() => center.markRead(allUnread)}>
            Marcar todas como lidas
          </Button>
        ) : null}
        <Hint label="Preferências de notificação">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setView("prefs")}
            aria-label="Preferências de notificação"
          >
            <SlidersHorizontalIcon aria-hidden />
          </Button>
        </Hint>
        {showClose ? <CloseButton onClose={onClose} /> : null}
      </div>
      <NotificationList
        groups={center.groups}
        now={center.data.now}
        filter={center.filter}
        onFilterChange={center.setFilter}
        onOpen={open}
        onMarkRead={center.markRead}
      />
    </>
  );
}
