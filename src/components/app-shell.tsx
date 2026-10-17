import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CircleHelpIcon,
  HistoryIcon,
  InboxIcon,
  LayoutGridIcon,
  MessageCircleIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Avatar, Hint, ProgressRing, TONE_TEXT, toneVar, type Tone } from "@/components/apple-ui";
import { HelpSheet } from "@/components/help-sheet";
import { NewSearchDialog } from "@/components/new-search-dialog";
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
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GLOSSARY, isHelpKey } from "@/lib/help";
import { withAttentionCount } from "@/lib/page-title";
import { accountQuery, attentionQuery, providerStatusQuery } from "@/lib/queries";
import { isTypingTarget } from "@/lib/shortcuts";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/" | "/leads" | "/conversas" | "/searches" | "/conta" | "/settings";
  label: string;
  icon: LucideIcon;
  tone: Tone;
};

const NAV: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutGridIcon, tone: "blue" },
  { to: "/leads", label: "Leads", icon: InboxIcon, tone: "green" },
  { to: "/conversas", label: "Conversas", icon: MessageCircleIcon, tone: "orange" },
  { to: "/searches", label: "Buscas", icon: HistoryIcon, tone: "purple" },
];
const SYSTEM_NAV: NavItem[] = [
  { to: "/conta", label: "Conta", icon: UserIcon, tone: "teal" },
  { to: "/settings", label: "Configurações", icon: SettingsIcon, tone: "gray" },
];

const SYSTEM_ATTENTION = "Algo precisa de atenção";

const NewSearchContext = createContext<() => void>(() => {});

/** Opens the "Busca manual" dialog from anywhere in the app. */
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
  return (
    <NewSearchContext value={() => setNewSearchOpen(true)}>
      <HelpContext value={openHelp}>
        <TooltipProvider delayDuration={300}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="h-svh overflow-hidden md:m-2.5 md:h-[calc(100svh-20px)] md:rounded-[18px] md:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),inset_0_1px_0_rgb(255_255_255/0.05),var(--shadow-panel)]">
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
          className="press h-8 gap-2.5 text-muted-foreground data-active:text-foreground hover:text-foreground"
        >
          <Link to={item.to}>
            <NavTile icon={item.icon} tone={item.tone} />
            <span>{item.label}</span>
            {warn ? <span className="sr-only"> · {SYSTEM_ATTENTION}</span> : null}
          </Link>
        </SidebarMenuButton>
        {item.to === "/conversas" && attention > 0 ? (
          <SidebarMenuBadge className="top-1.5! h-[18px] min-w-0 rounded-full bg-orange px-1.5 text-[11px] text-[#1b1000] tabular-nums">
            {attention}
            <span className="sr-only"> precisam de você</span>
          </SidebarMenuBadge>
        ) : null}
        {warn ? (
          <Hint label={SYSTEM_ATTENTION} side="right">
            <SidebarMenuBadge
              data-testid="system-attention"
              className="pointer-events-auto top-1.5!"
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
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="gap-3 px-2.5 pt-3.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <Link to="/">
                <span className="grid aspect-square size-[30px] shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(180deg,#5be38f,#22b45a)] text-[13px] font-semibold text-[#032d12] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_4px_12px_rgb(48_209_88/0.25)]">
                  N
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[13.5px] font-medium">Nelcota Leads</span>
                  <span className="truncate text-[11.5px] font-light text-muted-foreground">
                    Prospecção B2B
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <button
          type="button"
          onClick={openNewSearch}
          className="press flex h-[30px] items-center gap-2 rounded-[9px] bg-fill-2 px-2.5 text-[12.5px] text-tertiary transition-colors hover:bg-fill hover:text-muted-foreground group-data-[collapsible=icon]:hidden"
        >
          <SearchIcon className="size-3.5" />
          Nova busca
        </button>
      </SidebarHeader>
      <SidebarContent className="px-0.5">
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="h-7 text-[11.5px] font-medium text-tertiary">
            Prospecção
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">{NAV.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="h-7 text-[11.5px] font-medium text-tertiary">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">{SYSTEM_NAV.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-1.5 px-2.5 pb-2.5">
        <UsageMeter />
        <AccountRow />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** Gray when the item is idle; takes its color on hover and when active (see styles.css). */
function NavTile({ icon: Icon, tone }: { icon: LucideIcon; tone: Tone }) {
  return (
    <span
      aria-hidden
      className="nav-tile grid size-[22px] shrink-0 place-items-center rounded-[6px] text-white"
      style={{ "--tone": toneVar(tone) }}
    >
      <Icon className="size-3!" strokeWidth={2.2} />
    </span>
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
    <div className="grid gap-3 rounded-[14px] bg-black/[0.03] p-3 shadow-[inset_0_0_0_1px_var(--sidebar-border)] group-data-[collapsible=icon]:hidden dark:bg-white/[0.045]">
      {mail.configured ? (
        <MeterRow
          value={percent(mail.sentToday, mail.limit)}
          tone="green"
          used={mail.sentToday}
          limit={mail.limit}
          label="e-mails hoje"
          info={GLOSSARY.dailyLimit.text}
        />
      ) : (
        <Link
          to="/settings"
          hash="email"
          className="flex items-center gap-2.5 text-[12.5px] font-medium text-orange"
        >
          <span className="size-2 rounded-full bg-orange" />
          Conectar e-mail
        </Link>
      )}
      <MeterRow
        value={percent(placesUsage.used, placesUsage.limit)}
        tone="blue"
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
      className="flex items-center gap-2.5 rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      {...(info
        ? { tabIndex: 0, role: "group", "aria-label": `${used} de ${limit} ${label}` }
        : {})}
    >
      <ProgressRing value={value} tone={tone} size={32} thickness={4} track="var(--card-2)" />
      <div className="leading-tight">
        <p className="font-medium tabular-nums">
          {used} <span className="font-normal text-tertiary">de {limit}</span>
        </p>
        <p className="text-xs font-light text-muted-foreground">{label}</p>
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
            <Avatar name={name} src={account?.avatar} size={28} />
            <div className="min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[12.5px] font-medium">{name}</p>
              <p
                className={cn(
                  "flex min-w-0 items-center gap-1.5 text-[11.5px]",
                  address ? "text-green" : "text-orange",
                )}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-current" />
                <span className="truncate">{address ?? "Caixa não conectada"}</span>
              </p>
            </div>
          </>
        )}
      </Link>
      <div className="flex shrink-0 items-center group-data-[collapsible=icon]:flex-col">
        <Hint label="Ajuda" side="top">
          <button
            type="button"
            onClick={openHelp}
            aria-label="Ajuda"
            aria-keyshortcuts="?"
            className="press grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-fill-2 hover:text-foreground"
          >
            <CircleHelpIcon className="size-3.5" />
          </button>
        </Hint>
        <Hint label={dark ? "Tema claro" : "Tema escuro"} side="top">
          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label={dark ? "Tema claro" : "Tema escuro"}
            className="press grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-fill-2 hover:text-foreground"
          >
            {dark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
          </button>
        </Hint>
      </div>
    </div>
  );
}

/**
 * The standard page frame inside the floating content panel: a toolbar with the large title
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
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 sm:h-16 lg:pr-5 lg:pl-6">
        <Hint label="Menu">
          <SidebarTrigger
            aria-label="Mostrar ou esconder o menu"
            className="-ml-1 size-9 text-tertiary md:hidden"
          />
        </Hint>
        <h1 className="min-w-0 flex-1 truncate text-xl font-medium tracking-[-0.03em] sm:text-2xl">
          {title}
        </h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {bleed ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pt-1 pb-12 lg:px-6">
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
