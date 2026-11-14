import { Link } from "@tanstack/react-router";
import {
  CalendarIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleAlertIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  type IconComponent,
} from "@/components/icons";
import type { TodayKind, TodayLine } from "@/lib/team-member";
import { cn } from "@/lib/utils";

const ICONS: Record<TodayKind, IconComponent> = {
  due: RotateCcwIcon,
  late: CircleAlertIcon,
  waiting: MessageCircleIcon,
  meeting: CalendarIcon,
  none: CircleCheckIcon,
};

const TONES: Record<TodayKind, string> = {
  due: "text-blue",
  late: "text-red",
  waiting: "text-orange",
  meeting: "text-green",
  none: "text-gray",
};

const ROW = "-mx-2 flex min-h-11 items-center gap-2.5 rounded-[10px] px-2 text-base";

function TodayRow({ line }: { line: TodayLine }) {
  const Icon = ICONS[line.kind];
  if (!line.link) {
    return (
      <div className={cn(ROW, "text-muted-foreground")}>
        <Icon aria-hidden className="size-[18px] shrink-0 text-gray" />
        <span className="min-w-0 flex-1">{line.text}</span>
      </div>
    );
  }
  return (
    <Link
      {...line.link}
      aria-label={line.label}
      className={cn(ROW, "row-hover group hover:bg-fill-2 focus-visible:bg-fill-2")}
    >
      <Icon aria-hidden className={cn("size-[18px] shrink-0", TONES[line.kind])} />
      <span className="min-w-0 flex-1 truncate">{line.text}</span>
      <ChevronRightIcon
        aria-hidden
        className="row-chev size-4 shrink-0 text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </Link>
  );
}

/** "Hoje": follow-ups due, overdue, conversations waiting and the next meeting. */
export function PartnerToday({ lines }: { lines: TodayLine[] }) {
  return (
    <div className="mt-4 grid gap-0.5 border-t border-border/60 pt-3">
      <p className="pb-1 text-sm font-semibold text-tertiary">Hoje</p>
      {lines.map((line) => (
        <TodayRow key={line.kind} line={line} />
      ))}
    </div>
  );
}
