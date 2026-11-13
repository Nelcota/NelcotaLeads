import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/icons";

type ChipTone = "gray" | "green" | "blue";

const CHIP_TONE: Record<ChipTone, string> = {
  gray: "text-muted-foreground",
  green: "text-green",
  blue: "text-blue",
};

/** Outline shared by the panel and every card in it (1px, visible in both themes). */
const PANEL_OUTLINE = "border border-foreground/15";

/** Text fields inside the panel: neutral fill (never near-black) with a visible outline. */
export const PANEL_FIELD =
  "border border-foreground/15 bg-fill-3! shadow-none! hover:border-foreground/30 focus-visible:border-primary dark:bg-fill-3!";

/** The bare line icon in front of a card title, in its tone; the box keeps the title aligned. */
export function TitleChip({ icon: Icon, tone = "gray" }: { icon: IconComponent; tone?: ChipTone }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-[30px] shrink-0 place-items-center", CHIP_TONE[tone])}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

/** A bordered card of the lead panel: a title with its icon, then the content. */
export function PanelSection({
  title,
  icon: Icon,
  status,
  children,
}: {
  title: string;
  icon: IconComponent;
  /** Quiet feedback after the title, e.g. "Salvo". */
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={cn("grid gap-3.5 rounded-[20px] bg-card-2 px-5 py-[18px]", PANEL_OUTLINE)}>
      <div className="flex items-start gap-3">
        <TitleChip icon={Icon} />
        <h3 className="mt-1 min-w-0 flex-1 text-base leading-[22px] font-semibold">{title}</h3>
        {status ? <div className="mt-1 shrink-0">{status}</div> : null}
      </div>
      {children}
    </section>
  );
}
