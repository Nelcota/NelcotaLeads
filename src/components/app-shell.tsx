import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleHelpIcon,
  HistoryIcon,
  InboxIcon,
  LayoutGridIcon,
  MessageCircleIcon,
  MoonIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Avatar, Hint, TONE_TEXT, toneVar, type Tone } from "@/components/apple-ui";
import { HelpSheet } from "@/components/help-sheet";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NewSearchDialog } from "@/components/new-search-dialog";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNotificationAlerts } from "@/hooks/use-notification-alerts";
import { useNotifications } from "@/hooks/use-notifications";
import { GLOSSARY, isHelpKey } from "@/lib/help";
import { withAttentionCount } from "@/lib/page-title";
import { accountQuery, attentionQuery, providerStatusQuery, todayAgendaQuery } from "@/lib/queries";
import { isTypingTarget } from "@/lib/shortcuts";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/" | "/leads" | "/conversas" | "/agenda" | "/searches" | "/equipe" | "/conta" | "/settings";
  label: string;
  icon: LucideIcon;
};

const NAV: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutGridIcon },
  { to: "/leads", label: "Leads", icon: InboxIcon },
  { to: "/conversas", label: "Conversas", icon: MessageCircleIcon },
  { to: "/agenda", label: "Agenda", icon: CalendarIcon },
  { to: "/searches", label: "Buscas", icon: HistoryIcon },
];
const SYSTEM_NAV: NavItem[] = [
  { to: "/equipe", label: "Equipe", icon: UsersIcon },
  { to: "/conta", label: "Conta", icon: UserIcon },
  { to: "/settings", label: "Configurações", icon: SettingsIcon },
];

const SYSTEM_ATTENTION = "Algo precisa de atenção";

/** One look for every sidebar row: 44px tall, the active page in solid blue, centered in icon mode. */
const ITEM_CLASS =
  "h-11 gap-3 rounded-[12px] px-3.5 text-[15px] text-muted-foreground hover:bg-fill-2 hover:text-foreground active:bg-fill data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:shadow-none data-active:hover:bg-primary data-active:hover:text-primary-foreground group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!";

/** Count badges centered on a 44px row. */
const BADGE_CLASS =
  "top-[13px]! right-2.5 h-[18px] min-w-0 rounded-full px-1.5 text-[12px] tabular-nums";

const GROUP_LABEL_CLASS = "h-8 px-3.5 text-[13px] font-semibold text-tertiary";

const NewSearchContext = createContext<() => void>(() => {});

/** Opens the "Nova busca" dialog from anywhere in the app. */
export function useOpenNewSearch() {
  return useContext(NewSearchContext);
}

const HelpContext = createContext<() => void>(() => {});

/** "?" (Shift + /) opens the help from any screen, except while the user types. */
function useHelpKey(open: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isHelpKey(event) || isTypingTarget(event.target)) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
}

/**
 * Keeps the "Precisa de você" count in front of the tab title on every page. The routes own
 * the title itself (their `head`), so the count is put back whenever a navigation rewrites it.
 */
function useAttentionTitle() {
  const { data: attention = 0 } = useQuery(attentionQuery);
  useEffect(() => {
    const apply = () => {
      const next = withAttentionCount(document.title, attention);
      if (next !== document.title) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = withAttentionCount(document.title, 0);
    };
  }, [attention]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [newSearchOpen, setNewSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useAttentionTitle();
  useHelpKey(openHelp);
  useNotificationAlerts(useNotifications());
  return (
    <NewSearchContext value={() => setNewSearchOpen(true)}>
      <HelpContext value={openHelp}>
        <TooltipProvider delayDuration={300}>
          <SidebarProvider>
            <AppSidebar />
            {/* Same background as the sidebar; a thin outline with a rounded top-left corner
                frames the pages so the cards do not float, like Nelcota PRs. */}
            <SidebarInset className="h-svh overflow-hidden md:mt-2.5 md:h-[calc(100svh-10px)] md:rounded-tl-[28px] md:border-t md:border-l md:border-border">
              {children}
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
        <NewSearchDialog open={newSearchOpen} onOpenChange={setNewSearchOpen} />
        <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
      </HelpContext>
    </NewSearchContext>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: attention = 0 } = useQuery(attentionQuery);
  const { data: provider } = useQuery(providerStatusQuery);
  // Today's meetings and follow-ups, on the Agenda item.
  const { data: agendaToday } = useQuery(todayAgendaQuery);
  const todayCount = agendaToday?.entries.length ?? 0;
  const systemAttention = provider?.systemAttention ?? false;
  const openNewSearch = useOpenNewSearch();
  const isActive = (to: NavItem["to"]) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const renderItem = (item: NavItem) => {
    const warn = item.to === "/conta" && systemAttention;
    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton
          asChild
          isActive={isActive(item.to)}
          tooltip={warn ? `${item.label} · ${SYSTEM_ATTENTION}` : item.label}
          className={ITEM_CLASS}
        >
          <Link to={item.to}>
            <item.icon aria-hidden className="size-[18px]!" />
            <span>{item.label}</span>
            {warn ? <span className="sr-only"> · {SYSTEM_ATTENTION}</span> : null}
          </Link>
        </SidebarMenuButton>
        {item.to === "/conversas" && attention > 0 ? (
          <SidebarMenuBadge className={cn(BADGE_CLASS, "bg-orange text-[#1b1000]")}>
            {attention}
            <span className="sr-only"> precisam de você</span>
          </SidebarMenuBadge>
        ) : null}
        {item.to === "/agenda" && todayCount > 0 ? (
          <SidebarMenuBadge
            className={cn(
              BADGE_CLASS,
              "bg-blue text-white peer-data-active/menu-button:bg-white/25",
            )}
          >
            {todayCount}
            <span className="sr-only"> hoje</span>
          </SidebarMenuBadge>
        ) : null}
        {warn ? (
          <Hint label={SYSTEM_ATTENTION} side="right">
            <SidebarMenuBadge
              data-testid="system-attention"
              className="pointer-events-auto top-[13px]! right-2.5"
              aria-hidden
            >
              <span className="size-2 rounded-full bg-orange" />
            </SidebarMenuBadge>
          </Hint>
        ) : null}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="gap-5 px-2.5 pt-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-transparent group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-1!"
            >
              <Link to="/">
                <span className="grid aspect-square size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-[16px] font-bold text-primary-foreground">
                  N
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[18px] font-bold">Nelcota Leads</span>
                  <span className="truncate text-[13px] font-normal text-muted-foreground">
                    Prospecção B2B
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Button
          type="button"
          variant="outline"
          onClick={openNewSearch}
          className="group-data-[collapsible=icon]:hidden"
        >
          <PlusIcon aria-hidden className="size-4" />
          Nova busca
        </Button>
      </SidebarHeader>
      <SidebarContent className="px-0.5">
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className={GROUP_LABEL_CLASS}>Prospecção</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{NAV.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* Sistema sits at the bottom, next to the account, like Nelcota PRs. */}
        <SidebarGroup className="mt-auto py-1">
          <SidebarGroupLabel className={GROUP_LABEL_CLASS}>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{SYSTEM_NAV.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-2.5 pt-0 pb-3">
        <CollapseMenuButton />
        <UsageMeter />
        <AccountRow />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * "Recolher menu" at the bottom of the desktop sidebar: toggles icon mode (also Ctrl+B).
 * Outside the navigation, so screen readers do not read it as a page.
 */
function CollapseMenuButton() {
  const { isMobile, state, toggleSidebar } = useSidebar();
  if (isMobile) return null;
  const collapsed = state === "collapsed";
  const label = collapsed ? "Expandir menu" : "Recolher menu";
  const Icon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          aria-keyshortcuts="Control+B Meta+B"
          tooltip={label}
          className={cn(ITEM_CLASS, "text-tertiary")}
        >
          <Icon aria-hidden className="size-[18px]!" />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function percent(used: number, limit: number) {
  return limit > 0 ? (used / limit) * 100 : 0;
}

function UsageMeter() {
  const { data } = useQuery(providerStatusQuery);
  if (!data) return null;
  const { mail, placesUsage } = data;
  return (
    <div className="grid gap-3 border-t border-sidebar-border px-2 pt-3.5 group-data-[collapsible=icon]:hidden">
      {mail.configured ? (
        <MeterRow
          value={percent(mail.sentToday, mail.limit)}
          tone="blue"
          used={mail.sentToday}
          limit={mail.limit}
          label="e-mails hoje"
          info={GLOSSARY.dailyLimit.text}
        />
      ) : (
        <Link
          to="/settings"
          hash="email"
          className="flex items-center gap-2 text-[14px] font-semibold text-foreground"
        >
          <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-orange" />
          E-mail não conectado
        </Link>
      )}
      <MeterRow
        value={percent(placesUsage.used, placesUsage.limit)}
        tone="gray"
        used={placesUsage.used}
        limit={placesUsage.limit}
        label="buscas no Google"
      />
    </div>
  );
}

function MeterRow({
  value,
  tone,
  used,
  limit,
  label,
  info,
}: {
  value: number;
  tone: Tone;
  used: number;
  limit: number;
  label: string;
  /** Explains the limit in a tooltip on the meter itself (hover or keyboard focus). */
  info?: string;
}) {
  const row = (
    <div
      className="grid gap-1.5 rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      {...(info
        ? { tabIndex: 0, role: "group", "aria-label": `${used} de ${limit} ${label}` }
        : {})}
    >
      <div className="flex items-baseline justify-between gap-2 text-[14px] leading-tight">
        <span className="text-muted-foreground first-letter:uppercase">{label}</span>
        <span className="font-semibold tabular-nums">
          {used} de {limit}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-fill-2" aria-hidden>
        <div
          className="bar-grow h-full rounded-full"
          style={{ width: `${Math.min(value, 100)}%`, background: toneVar(tone) }}
        />
      </div>
    </div>
  );
  // No extra icon here: without failures the sidebar keeps only what it had (plus "?").
  return info ? (
    <Hint
      label={<span className="block max-w-64 font-normal leading-snug">{info}</span>}
      side="right"
    >
      {row}
    </Hint>
  ) : (
    row
  );
}

/** Who is signed in, with the mailbox status under the name. */
function AccountRow() {
  const { data } = useQuery(providerStatusQuery);
  const { data: account } = useQuery(accountQuery);
  const { theme, setTheme } = useTheme();
  const openHelp = useContext(HelpContext);
  const dark = theme === "dark";
  const address = data?.mail.configured ? data.mail.address : null;
  const name = account?.name ?? "Sua conta";
  // Until both answer, a neutral placeholder: never "Caixa não conectada" for a connected box.
  const loading = !data || !account;
  return (
    <div className="flex items-center gap-2.5 px-1 pt-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <Link
        to="/conta"
        className="press flex min-w-0 flex-1 items-center gap-2.5 rounded-[9px] group-data-[collapsible=icon]:hidden"
      >
        {loading ? (
          <div className="flex min-w-0 flex-1 items-center gap-2.5" aria-hidden>
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="grid min-w-0 flex-1 gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
        ) : (
          <>
            <Avatar name={name} src={account?.avatar} size={32} />
            <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[14px] font-medium">{name}</p>
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
                {address ? (
                  <CircleCheckIcon aria-hidden className="size-3.5 shrink-0 text-green" />
                ) : (
                  <CircleAlertIcon aria-hidden className="size-3.5 shrink-0 text-orange" />
                )}
                <span className="truncate">{address ?? "Caixa não conectada"}</span>
              </p>
            </div>
          </>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:flex-col">
        <Hint label="Ajuda" side="top">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={openHelp}
            aria-label="Ajuda"
            aria-keyshortcuts="?"
          >
            <CircleHelpIcon className="size-3.5" />
          </Button>
        </Hint>
        <Hint label={dark ? "Tema claro" : "Tema escuro"} side="top">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label={dark ? "Tema claro" : "Tema escuro"}
          >
            {dark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
          </Button>
        </Hint>
      </div>
    </div>
  );
}

/**
 * The standard page frame beside the sidebar, on the same background: a toolbar with the large title
 * and the page actions, an optional summary line, then the scrolling content.
 */
export function Page({
  title,
  description,
  actions,
  bleed = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Full-height content without padding (Conversas). */
  bleed?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {/* The same scrollbar gutter as the content below, so the header actions end where the
          cards end, whatever the scrollbar width. */}
      <header
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 px-4 sm:h-16 lg:px-6",
          !bleed && "overflow-hidden [scrollbar-gutter:stable]",
        )}
      >
        <Hint label="Menu">
          <SidebarTrigger
            aria-label="Mostrar ou esconder o menu"
            className="-ml-1 size-9 text-tertiary md:hidden"
          />
        </Hint>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
          {title}
        </h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        <NotificationBell />
      </header>
      {bleed ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 pt-1 pb-12 lg:px-6">
            {description ? (
              <p className="-mt-1 text-base font-light text-muted-foreground">{description}</p>
            ) : null}
            {children}
          </div>
        </div>
      )}
    </>
  );
}

/** A number in the summary line, colored by what it means. */
export function Stat({
  value,
  tone,
  children,
}: {
  value: number;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span className={cn(tone && TONE_TEXT[tone])}>
      <b className={cn("font-medium tabular-nums", !tone && "text-foreground")}>{value}</b>{" "}
      {children}
    </span>
  );
}
