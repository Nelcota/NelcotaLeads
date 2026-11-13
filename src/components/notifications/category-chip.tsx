import {
  CalendarIcon,
  ClockIcon,
  SearchIcon,
  MailIcon,
  type IconComponent,
} from "@/components/icons";
import { TONE_TEXT, type Tone } from "@/components/apple-ui";
import type { NotificationCategory } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<NotificationCategory, IconComponent> = {
  replies: MailIcon,
  followUps: ClockIcon,
  agenda: CalendarIcon,
  searches: SearchIcon,
};

const CATEGORY_TONE: Record<NotificationCategory, Tone> = {
  replies: "blue",
  followUps: "orange",
  agenda: "teal",
  searches: "green",
};

/** The category's bare line icon in its color (list-row icon standard: no chip behind it). */
export function CategoryChip({
  category,
  size = 34,
  className,
}: {
  category: NotificationCategory;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  const tone = CATEGORY_TONE[category];
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center", TONE_TEXT[tone], className)}
      style={{ width: size, height: size }}
    >
      <Icon className="size-4" />
    </span>
  );
}
