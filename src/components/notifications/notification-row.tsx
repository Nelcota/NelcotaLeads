import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, TriangleAlertIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { whenLabel, type NotificationHref, type NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { CategoryChip } from "./category-chip";

const ROW_CLASS =
  "group flex w-full items-start gap-3 px-5 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-fill-3 focus-visible:bg-fill-2 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40";

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

function ownerLabel(item: NotificationItem): string {
  if (item.category === "searches") return "Equipe";
  return item.ownerName ?? "Sem responsável";
}

/** One notification: bold while unread; clicking marks it read and goes to its origin. */
export function NotificationRow({
  item,
  now,
  onOpen,
}: {
  item: NotificationItem;
  now: number;
  onOpen: (item: NotificationItem) => void;
}) {
  const when = whenLabel(item, now);
  const state = item.unread ? "Não lida. " : "";
  const label = `${state}${item.title}: ${item.text}. ${when}, ${DESTINATION[item.href.to]}`;
  return (
    <OriginLink href={item.href} label={label} onOpen={() => onOpen(item)}>
      <CategoryChip category={item.category} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[15px]",
              item.unread ? "font-bold text-foreground" : "font-medium text-muted-foreground",
            )}
          >
            {item.title}
          </span>
          <span
            className={cn(
              "shrink-0 text-[12.5px] tabular-nums",
              item.unread ? "font-semibold text-blue" : "text-tertiary",
            )}
          >
            {when}
          </span>
        </span>
        <span
          className={cn(
            "line-clamp-2 text-sm leading-snug",
            item.unread ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {item.text}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
          {item.warning ? (
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlertIcon aria-hidden className="size-3.5 text-red" strokeWidth={2} />
              {item.warning}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <UserIcon aria-hidden className="size-3.5" strokeWidth={1.8} />
            {ownerLabel(item)}
          </span>
        </span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-4 shrink-0 self-center text-tertiary transition-transform duration-150 group-hover:translate-x-0.5"
        strokeWidth={1.8}
      />
    </OriginLink>
  );
}
