import { Link } from "@tanstack/react-router";
import {
  CalendarClockIcon,
  ChevronRightIcon,
  MessageCircleWarningIcon,
  PencilLineIcon,
  SearchXIcon,
  type IconComponent,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { OverviewAlert, OverviewAlertKind } from "@/lib/overview";

const ICONS: Record<OverviewAlertKind, IconComponent> = {
  offer: PencilLineIcon,
  cooling: MessageCircleWarningIcon,
  search: SearchXIcon,
  followup: CalendarClockIcon,
};

/** One pending item as a pill: line icon in its tone, neutral text, opens its filtered list. */
function AlertPill({ alert }: { alert: OverviewAlert }) {
  const Icon = ICONS[alert.kind];
  return (
    <Button asChild variant="outline">
      <Link {...alert.link} aria-label={`${alert.label}. ${alert.hint}`}>
        <Icon aria-hidden className={alert.tone === "red" ? "text-red" : "text-orange"} />
        <span className="text-base">{alert.label}</span>
        <ChevronRightIcon aria-hidden className="size-3.5 text-muted-foreground" />
      </Link>
    </Button>
  );
}

/** What is pending today, as a row of pills under the page description; nothing when all is done. */
export function OverviewAlerts({ alerts }: { alerts: OverviewAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <nav aria-label="Pendências de hoje" className="enter -mt-2 flex flex-wrap gap-2">
      {alerts.map((alert) => (
        <AlertPill key={alert.key} alert={alert} />
      ))}
    </nav>
  );
}
