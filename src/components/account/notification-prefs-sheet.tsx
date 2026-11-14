import { NotificationPrefsForm } from "@/components/notifications/notification-prefs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NotificationPrefs } from "@/lib/notifications";

/** The same notification preferences as the bell's panel, opened from Conta. */
export function NotificationPrefsSheet({
  open,
  onOpenChange,
  prefs,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: NotificationPrefs;
  onChange: (prefs: NotificationPrefs) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 overflow-y-auto overscroll-contain">
        <SheetHeader>
          <SheetTitle>Notificações</SheetTitle>
          <SheetDescription>O que chega no sino e como avisa. Vale só para você.</SheetDescription>
        </SheetHeader>
        <NotificationPrefsForm prefs={prefs} onChange={onChange} />
      </SheetContent>
    </Sheet>
  );
}
