import { BellIcon } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNotifications, type NotificationCenter } from "@/hooks/use-notifications";
import { unreadBadge } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { NotificationCenterPanel } from "./notification-center";

const PANEL_HEADING = "text-[17px] font-semibold tracking-[-0.01em]";

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
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title="Notificações"
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-full border border-border text-foreground outline-none transition-[background-color,transform] duration-150 hover:bg-fill-2 focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.96] pointer-coarse:after:absolute pointer-coarse:after:-inset-1",
        open && "bg-fill-2",
        className,
      )}
      {...props}
    >
      <BellIcon aria-hidden className="size-[19px]" strokeWidth={1.8} />
      {badge ? (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[11px] font-bold text-primary-foreground tabular-nums"
        >
          {badge}
        </span>
      ) : null}
    </button>
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
        className="inset-0! w-full! max-w-none! gap-0 overflow-y-auto overscroll-contain rounded-none! border-0 bg-background shadow-none!"
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
      <PopoverTrigger asChild>
        <BellButton count={center.unreadCount} open={open} aria-haspopup="dialog" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        aria-label="Notificações"
        className="flex max-h-[min(680px,calc(100svh-96px))] w-[440px] flex-col overflow-y-auto overscroll-contain rounded-[28px] border border-border bg-popover p-0 shadow-none!"
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

/**
 * The bell on every page: the unread count, and the notification panel on click (a popover on
 * desktop, a full-screen sheet on the phone). Renders nothing while NOTIFICATIONS_ENABLED is off.
 */
export function NotificationBell() {
  const center = useNotifications();
  const isMobile = useIsMobile();
  if (!center) return null;
  if (isMobile) return <PhoneBell center={center} />;
  return <DesktopBell center={center} />;
}
