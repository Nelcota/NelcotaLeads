import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import {
  CalendarIcon,
  CircleHelpIcon,
  InboxIcon,
  LayoutGridIcon,
  MessageCircleIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import {
  SidebarNavItem,
  ITEM_CLASS,
  isOnPage,
  type NavItem,
  type NavPath,
} from "@/components/sidebar/sidebar-nav-item";
import { SidebarStatusCard } from "@/components/sidebar/sidebar-status-card";
import { WorkspaceMenu } from "@/components/sidebar/workspace-menu";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { badgeCount } from "@/lib/badge-count";
import { attentionQuery, todayAgendaQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** The day's work. */
const WORK_NAV: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutGridIcon },
  { to: "/leads", label: "Leads", icon: InboxIcon },
  { to: "/conversas", label: "Conversas", icon: MessageCircleIcon },
  { to: "/agenda", label: "Agenda", icon: CalendarIcon },
];

/** Filling the base and organizing the team. */
const SETUP_NAV: NavItem[] = [
  { to: "/searches", label: "Buscas", icon: SearchIcon },
  { to: "/equipe", label: "Equipe", icon: UsersIcon },
];

const SETTINGS_ITEM: NavItem = { to: "/settings", label: "Configurações", icon: SettingsIcon };

/** Count badges centered on a 44px row; the text keeps its color on hover and on the active row. */
const BADGE_CLASS =
  "top-[13px]! right-2.5 h-[18px] min-w-0 rounded-full px-1.5 text-2xs tabular-nums text-on-tone peer-hover/menu-button:text-on-tone peer-data-active/menu-button:text-on-tone";

/**
 * The sidebar in four zones: who and where on top, "Nova busca", the pages in two groups, and at
 * the bottom one status card above Configurações and Ajuda.
 */
export function AppSidebar({
  onNewSearch,
  onOpenHelp,
}: {
  onNewSearch: () => void;
  onOpenHelp: () => void;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: attention = 0 } = useQuery(attentionQuery);
  // Today's meetings and follow-ups, on the Agenda item.
  const { data: agendaToday } = useQuery(todayAgendaQuery);
  const todayCount = agendaToday?.entries.length ?? 0;

  const badgeFor = (to: NavPath) => {
    if (to === "/conversas" && attention > 0) {
      return (
        <SidebarMenuBadge className={cn(BADGE_CLASS, "bg-orange")}>
          <span aria-hidden>{badgeCount(attention)}</span>
          <span className="sr-only">{attention} precisam de você</span>
        </SidebarMenuBadge>
      );
    }
    if (to === "/agenda" && todayCount > 0) {
      return (
        <SidebarMenuBadge className={cn(BADGE_CLASS, "bg-blue")}>
          <span aria-hidden>{badgeCount(todayCount)}</span>
          <span className="sr-only">{todayCount} hoje</span>
        </SidebarMenuBadge>
      );
    }
    return null;
  };

  const renderItem = (item: NavItem) => (
    <SidebarNavItem
      key={item.to}
      item={item}
      active={isOnPage(pathname, item.to)}
      badge={badgeFor(item.to)}
    />
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="gap-5 px-2.5 pt-5">
        <WorkspaceMenu />
        <Button
          type="button"
          variant="outline"
          onClick={onNewSearch}
          className="group-data-[collapsible=icon]:hidden"
        >
          <PlusIcon aria-hidden className="size-4" />
          Nova busca
        </Button>
      </SidebarHeader>
      <SidebarContent className="px-0.5 pt-2">
        {/* One landmark for the page links, so screen readers can jump to the menu. */}
        <nav aria-label="Menu principal" className="contents">
          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{WORK_NAV.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator className="mx-5 my-1 bg-border" />
          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{SETUP_NAV.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter className="gap-3 px-2.5 pt-0 pb-3">
        <SidebarStatusCard />
        <nav aria-label="Configurações e ajuda" className="contents">
          <SidebarMenu className="gap-1">
            {renderItem(SETTINGS_ITEM)}
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={onOpenHelp}
                aria-keyshortcuts="?"
                tooltip="Ajuda"
                className={ITEM_CLASS}
              >
                <CircleHelpIcon aria-hidden className="size-[18px]!" />
                <span className="flex-1">Ajuda</span>
                <kbd
                  aria-hidden
                  className="grid h-5 min-w-5 place-items-center rounded-md border border-border px-1 font-sans text-2xs text-tertiary group-data-[collapsible=icon]:hidden"
                >
                  ?
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </nav>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
