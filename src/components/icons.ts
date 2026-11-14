/**
 * The app's only icon source: Solar Linear icons compiled by unplugin-icons, so only
 * the icons listed here ship and nothing is fetched at runtime. One icon per function
 * (roadmap 2026-11-10 and 2026-11-13): screens import from here, never from the package.
 * The export names describe the function and match the old Lucide names, so in-flight
 * branches only switch their import line.
 */
import type { ComponentType, SVGProps } from "react";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Navigation and arrows
export { default as ChevronRightIcon } from "~icons/solar/alt-arrow-right-linear";
export { default as ChevronLeftIcon } from "~icons/solar/alt-arrow-left-linear";
export { default as ChevronDownIcon } from "~icons/solar/alt-arrow-down-linear";
export { default as ChevronUpIcon } from "~icons/solar/alt-arrow-up-linear";
export { default as ChevronsUpDownIcon } from "~icons/solar/sort-vertical-linear";
export { default as ArrowRightIcon } from "~icons/solar/arrow-right-linear";
export { default as ArrowLeftIcon } from "~icons/solar/arrow-left-linear";
export { default as ArrowUpIcon } from "~icons/solar/arrow-up-linear";
export { default as ArrowDownIcon } from "~icons/solar/arrow-down-linear";
export { default as ArrowUpRightIcon } from "~icons/solar/arrow-right-up-linear";
export { default as ArrowRightCircleIcon } from "~icons/solar/round-arrow-right-linear";

// Basic actions
export { default as XIcon } from "~icons/solar/close-linear";
export { default as CheckIcon } from "~icons/solar/check-linear";
export { default as PlusIcon } from "~icons/solar/add-linear";
export { default as MinusIcon } from "~icons/solar/minus-linear";
export { default as SearchIcon } from "~icons/solar/magnifer-linear";
export { default as SearchXIcon } from "~icons/solar/magnifier-close-linear";
export { default as ZoomInIcon } from "~icons/solar/magnifer-zoom-in-linear";
export { default as ZoomOutIcon } from "~icons/solar/magnifer-zoom-out-linear";
export { default as CopyIcon } from "~icons/solar/copy-linear";
export { default as LinkIcon } from "~icons/solar/link-linear";
export { default as DownloadIcon } from "~icons/solar/download-minimalistic-linear";
export { default as Trash2Icon } from "~icons/solar/trash-bin-trash-linear";
export { default as PencilIcon } from "~icons/solar/pen-linear";
export { default as PencilLineIcon } from "~icons/solar/pen-2-linear";
export { default as PenLineIcon } from "~icons/solar/pen-new-square-linear";
export { default as RotateCcwIcon } from "~icons/solar/restart-linear";
export { default as RotateCwIcon } from "~icons/solar/refresh-linear";
export { default as RefreshCwIcon } from "~icons/solar/refresh-circle-linear";
export { default as Undo2Icon } from "~icons/solar/undo-left-linear";
export { default as ShuffleIcon } from "~icons/solar/shuffle-linear";
export { default as EllipsisIcon } from "~icons/solar/menu-dots-linear";
export { default as FunnelIcon } from "~icons/solar/filter-linear";
export { default as FilterXIcon } from "~icons/solar/filter-close-linear";
export { default as SlidersHorizontalIcon } from "~icons/solar/tuning-2-linear";
export { default as BrushCleaningIcon } from "~icons/solar/broom-linear";
export { default as EyeIcon } from "~icons/solar/eye-linear";
export { default as EyeOffIcon } from "~icons/solar/eye-closed-linear";
export { default as PlayIcon } from "~icons/solar/play-linear";
export { default as PauseIcon } from "~icons/solar/pause-linear";
export { default as LogOutIcon } from "~icons/solar/logout-2-linear";
export { default as ImageIcon } from "~icons/solar/gallery-linear";
export { default as ImageUpIcon } from "~icons/solar/gallery-send-linear";

// Status
export { default as CircleCheckIcon } from "~icons/solar/check-circle-linear";
export { default as CircleMinusIcon } from "~icons/solar/minus-circle-linear";
export { default as CircleXIcon } from "~icons/solar/close-circle-linear";
export { default as XCircleIcon } from "~icons/solar/close-circle-linear";
export { default as CircleAlertIcon } from "~icons/solar/danger-circle-linear";
export { default as TriangleAlertIcon } from "~icons/solar/danger-triangle-linear";
export { default as OctagonXIcon } from "~icons/solar/forbidden-linear";
export { default as BanIcon } from "~icons/solar/forbidden-circle-linear";
export { default as InfoIcon } from "~icons/solar/info-circle-linear";
export { default as CircleHelpIcon } from "~icons/solar/question-circle-linear";
export { default as CircleDotIcon } from "~icons/solar/record-circle-linear";
export { SpinnerIcon as LoaderCircleIcon, SpinnerIcon as Loader2Icon } from "./spinner-icon";

// Time and calendar
export { default as ClockIcon } from "~icons/solar/clock-circle-linear";
export { default as ClockAlertIcon } from "~icons/solar/alarm-linear";
export { default as AlarmClockIcon } from "~icons/solar/alarm-linear";
export { default as TimerIcon } from "~icons/solar/stopwatch-linear";
export { default as HistoryIcon } from "~icons/solar/history-linear";
export { default as CalendarIcon } from "~icons/solar/calendar-linear";
export { default as CalendarDaysIcon } from "~icons/solar/calendar-date-linear";
export { default as CalendarPlusIcon } from "~icons/solar/calendar-add-linear";
export { default as CalendarClockIcon } from "~icons/solar/calendar-mark-linear";

// Communication
export { default as MailIcon } from "~icons/solar/letter-linear";
export { default as MailCheckIcon } from "~icons/solar/letter-opened-linear";
export { default as MailXIcon } from "~icons/solar/danger-circle-linear";
export { default as SendIcon } from "~icons/solar/plain-linear";
export { default as InboxIcon } from "~icons/solar/inbox-linear";
export { default as PhoneIcon } from "~icons/solar/phone-linear";
export { default as VideoIcon } from "~icons/solar/videocamera-linear";
export { default as MessageCircleIcon } from "~icons/solar/chat-round-linear";
export { default as MessageCircleWarningIcon } from "~icons/solar/chat-round-warning-linear";
export { default as MessageSquareTextIcon } from "~icons/solar/chat-square-linear";
export { default as MessagesSquareIcon } from "~icons/solar/chat-line-linear";
export { default as BellIcon } from "~icons/solar/bell-linear";
export { default as Volume2Icon } from "~icons/solar/volume-loud-linear";

// People
export { default as UserIcon } from "~icons/solar/user-linear";
export { default as UsersIcon } from "~icons/solar/users-group-rounded-linear";
export { default as UserPlusIcon } from "~icons/solar/user-plus-linear";
export { default as ContactIcon } from "~icons/solar/user-id-linear";
export { default as HandIcon } from "~icons/solar/user-hand-up-linear";
export { default as HandshakeIcon } from "~icons/solar/hand-shake-linear";

// Places and things
export { default as GlobeIcon } from "~icons/solar/global-linear";
export { default as MapIcon } from "~icons/solar/map-linear";
export { default as MapPinIcon } from "~icons/solar/map-point-linear";
export { default as CompassIcon } from "~icons/solar/compass-linear";
export { default as TagIcon } from "~icons/solar/tag-linear";
export { default as StarIcon } from "~icons/solar/star-linear";
export { default as TargetIcon } from "~icons/solar/target-linear";
export { default as FileTextIcon } from "~icons/solar/document-text-linear";
export { default as StickyNoteIcon } from "~icons/solar/notes-linear";
export { default as ListChecksIcon } from "~icons/solar/checklist-minimalistic-linear";
export { default as LayoutGridIcon } from "~icons/solar/widget-linear";
export { default as LayersIcon } from "~icons/solar/layers-linear";
export { default as SettingsIcon } from "~icons/solar/settings-linear";
export { default as PlugZapIcon } from "~icons/solar/plug-circle-linear";
export { default as BotIcon } from "~icons/solar/cpu-linear";
export { default as SparklesIcon } from "~icons/solar/stars-minimalistic-linear";
export { default as SunIcon } from "~icons/solar/sun-linear";
export { default as MoonIcon } from "~icons/solar/moon-linear";

// Charts
export { default as ChartColumnIcon } from "~icons/solar/chart-2-linear";
export { default as TrendingUpIcon } from "~icons/solar/graph-up-linear";
export { default as TrendingDownIcon } from "~icons/solar/graph-down-linear";
export { default as GaugeIcon } from "~icons/solar/speedometer-middle-linear";

// Layout panels
export { default as PanelLeftIcon } from "~icons/solar/sidebar-minimalistic-linear";
export { default as PanelLeftOpenIcon } from "~icons/solar/sidebar-open-linear";
export { default as PanelLeftCloseIcon } from "~icons/solar/sidebar-close-linear";
export { default as PanelRightOpenIcon } from "~icons/solar/panel-right-linear";
export { default as PanelRightCloseIcon } from "~icons/solar/panel-right-close-linear";
