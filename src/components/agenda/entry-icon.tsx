import {
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  VideoIcon,
  type IconComponent,
} from "@/components/icons";
import type { MeetingKind } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<MeetingKind, IconComponent> = {
  video: VideoIcon,
  call: PhoneIcon,
  in_person: MapPinIcon,
};

/** The gray line icon that tells a meeting's kind, or a clock for a follow-up. */
export function EntryIcon({ kind, className }: { kind: MeetingKind | null; className?: string }) {
  const Icon = kind ? KIND_ICONS[kind] : ClockIcon;
  return <Icon aria-hidden className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}
