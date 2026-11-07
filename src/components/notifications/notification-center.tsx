import { BrushCleaningIcon, ChevronLeftIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
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

  const open = (item: NotificationItem) => {
    if (item.unread) center.markRead([item.key]);
    onClose();
  };

  if (view === "prefs") {
    return (
      <>
        <div className="flex items-center gap-1 pt-2.5 pr-2 pb-1.5 pl-1.5">
          <Button
            variant="ghost"
            size="icon"
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
      <div className="flex items-center gap-0.5 pt-3 pr-2 pb-1.5 pl-4">
        <div className="flex-1">
          <Heading>Notificações</Heading>
        </div>
        {center.shownKeys.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => center.dismiss(center.shownKeys)}
            className="text-blue hover:text-blue"
          >
            <BrushCleaningIcon aria-hidden />
            Limpar tudo
          </Button>
        ) : null}
        <Hint label="Preferências de notificação">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("prefs")}
            aria-label="Preferências de notificação"
          >
            <SlidersHorizontalIcon aria-hidden />
          </Button>
        </Hint>
        {showClose ? <CloseButton onClose={onClose} /> : null}
      </div>
      <NotificationList
        sections={center.sections}
        now={center.data.now}
        filter={center.filter}
        onFilterChange={center.setFilter}
        onOpen={open}
        onDismiss={(item) => center.dismiss([item.key])}
      />
    </>
  );
}
