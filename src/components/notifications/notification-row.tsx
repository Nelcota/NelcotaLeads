import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { whenLabel, type NotificationHref, type NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { CategoryChip } from "./category-chip";

const ROW_CLASS =
  "flex min-h-13 w-full items-center gap-2.5 py-1.5 pr-10 pl-4 text-left outline-none focus-visible:bg-fill-2 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40";

/** The link to where a notification came from: the conversation, the lead, the day or the search. */
function OriginLink({
  href,
  label,
  onOpen,
  children,
}: {
  href: NotificationHref;
  label: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  if (href.to === "/searches/$searchId") {
    return (
      <Link
        to={href.to}
        params={href.params}
        aria-label={label}
        onClick={onOpen}
        className={ROW_CLASS}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to={href.to}
      search={href.search}
      aria-label={label}
      onClick={onOpen}
      className={ROW_CLASS}
    >
      {children}
    </Link>
  );
}

const DESTINATION: Record<NotificationHref["to"], string> = {
  "/conversas": "abre a conversa",
  "/leads": "abre o lead",
  "/agenda": "abre o dia na Agenda",
  "/searches/$searchId": "abre a busca",
};

/** The second line: the warning first when there is one ("Atrasado 2 dias · Retornar o contato"). */
function detailLine(item: NotificationItem): string {
  if (!item.warning) return item.text;
  return `${item.warning} · ${item.text}`;
}

/**
 * One notification, compact: title and time, then one line of text. Bold while unread; clicking
 * marks it read and goes to its origin; the X clears it from the panel.
 */
export function NotificationRow({
  item,
  now,
  onOpen,
  onDismiss,
}: {
  item: NotificationItem;
  now: number;
  onOpen: (item: NotificationItem) => void;
  onDismiss: (item: NotificationItem, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const when = whenLabel(item, now);
  const detail = detailLine(item);
  const state = item.unread ? "Não lida. " : "";
  const label = `${state}${item.title}: ${detail}. ${when}, ${DESTINATION[item.href.to]}`;
  return (
    <div className="group relative transition-colors duration-150 hover:bg-fill-3">
      <OriginLink href={item.href} label={label} onOpen={() => onOpen(item)}>
        <CategoryChip category={item.category} size={28} className="rounded-[8px]" />
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                item.unread ? "font-bold text-foreground" : "font-medium text-muted-foreground",
              )}
            >
              {item.title}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                item.unread ? "font-semibold text-blue" : "text-tertiary",
              )}
            >
              {when}
            </span>
          </span>
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-[13px]",
              item.unread ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {item.warning ? (
              <TriangleAlertIcon
                aria-hidden
                className="size-3.25 shrink-0 text-red"
                strokeWidth={2}
              />
            ) : null}
            <span className="min-w-0 truncate" title={detail}>
              {detail}
            </span>
          </span>
        </span>
      </OriginLink>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={(event) => onDismiss(item, event)}
        aria-label={`Limpar notificação de ${item.title}`}
        title="Limpar"
        className="absolute top-1/2 right-1.5 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
      >
        <XIcon aria-hidden className="size-3.5" strokeWidth={2} />
      </Button>
    </div>
  );
}
