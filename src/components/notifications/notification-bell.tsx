import { BellIcon } from "@/components/icons";
import { useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useNotifications, type NotificationCenter } from "@/hooks/use-notifications";
import { unreadBadge } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { NotificationCenterPanel } from "./notification-center";

const PANEL_HEADING = "text-base font-semibold tracking-[-0.01em]";
const noUpdates = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

/** The sheet's accessible title (phone). */
function SheetHeading({ children }: { children: ReactNode }) {
  return <SheetTitle className={PANEL_HEADING}>{children}</SheetTitle>;
}

/** A plain heading inside the popover (desktop). */
function PopoverHeading({ children }: { children: ReactNode }) {
  return <h2 className={PANEL_HEADING}>{children}</h2>;
}

type BellButtonProps = ComponentProps<"button"> & { count: number; open: boolean };

function BellButton({ count, open, className, ref, ...props }: BellButtonProps) {
  const badge = unreadBadge(count);
  const label = count > 0 ? `Notificações, ${count} não lidas` : "Notificações";
  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      aria-label={label}
      className={cn(open && "bg-fill-2", className)}
      {...props}
    >
      <BellIcon aria-hidden className="size-[19px]" />
      {badge ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-2xs font-bold text-primary-foreground tabular-nums"
        >
          {badge}
        </span>
      ) : null}
    </Button>
  );
}

function PhoneBell({ center }: { center: NotificationCenter }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <BellButton count={center.unreadCount} open={open} onClick={() => setOpen(true)} />
      <SheetContent
        side="right"
        showCloseButton={false}
        data-notification-panel
        tabIndex={-1}
        onOpenAutoFocus={focusPanel}
        className="inset-0! w-full! max-w-none! gap-0 overflow-y-auto overscroll-contain rounded-none! border-0 bg-background shadow-none! outline-none"
      >
        <SheetDescription className="sr-only">
          Respostas, retornos, agenda e buscas concluídas
        </SheetDescription>
        <NotificationCenterPanel
          center={center}
          showClose
          onClose={() => setOpen(false)}
          Heading={SheetHeading}
        />
      </SheetContent>
    </Sheet>
  );
}

function DesktopBell({ center }: { center: NotificationCenter }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Notificações">
        <PopoverTrigger asChild>
          <BellButton count={center.unreadCount} open={open} aria-haspopup="dialog" />
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        data-notification-panel
        tabIndex={-1}
        onOpenAutoFocus={focusPanel}
        onInteractOutside={keepOpenForToast}
        align="end"
        sideOffset={8}
        collisionPadding={16}
        aria-label="Notificações"
        className="flex max-h-[min(480px,calc(100svh-96px))] w-[360px] flex-col overflow-y-auto overscroll-contain rounded-[24px] border border-border bg-popover p-0 shadow-none! outline-none"
      >
        <NotificationCenterPanel
          center={center}
          showClose={false}
          onClose={() => setOpen(false)}
          Heading={PopoverHeading}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The panel itself takes focus on open: never "Limpar tudo", which one Enter would trigger. */
function focusPanel(event: Event) {
  event.preventDefault();
  const panel = document.querySelector<HTMLElement>("[data-notification-panel]");
  panel?.focus();
}

/** A click on a toast (its "Desfazer") is not a click outside the panel. */
function keepOpenForToast(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest("[data-sonner-toaster]")) {
    event.preventDefault();
  }
}

/**
 * The bell on every page: the unread count, and the notification panel on click (a popover on
 * desktop, a full-screen sheet on the phone). Renders nothing while NOTIFICATIONS_ENABLED is off.
 */
export function NotificationBell() {
  const center = useNotifications();
  const isMobile = useMediaQuery("(max-width: 767px)", false);
  // The query may resolve in the browser before hydration while SSR still rendered no bell.
  // Mounting it after hydration keeps the first server and client trees identical.
  const hydrated = useSyncExternalStore(noUpdates, clientHydrated, serverHydrated);
  if (!hydrated || !center) return null;
  if (isMobile) return <PhoneBell center={center} />;
  return <DesktopBell center={center} />;
}
