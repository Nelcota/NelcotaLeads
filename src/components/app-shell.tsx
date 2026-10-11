import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { NewSearchDialog } from "@/components/new-search-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { leadCountsQuery, providerStatusQuery } from "@/lib/queries";
import { useTheme } from "@/lib/theme";

const NAV: {
  to: "/" | "/leads" | "/searches" | "/settings";
  label: string;
  icon: LucideIcon;
}[] = [
  { to: "/", label: "Painel", icon: LayoutDashboardIcon },
  { to: "/leads", label: "Leads", icon: InboxIcon },
  { to: "/searches", label: "Buscas", icon: HistoryIcon },
  { to: "/settings", label: "Configurações", icon: SettingsIcon },
];

const NewSearchContext = createContext<() => void>(() => {});

/** Opens the "Busca manual" dialog from anywhere in the app. */
export function useOpenNewSearch() {
  return useContext(NewSearchContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [newSearchOpen, setNewSearchOpen] = useState(false);
  return (
    <NewSearchContext value={() => setNewSearchOpen(true)}>
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
      <NewSearchDialog open={newSearchOpen} onOpenChange={setNewSearchOpen} />
    </NewSearchContext>
  );
}

function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: counts } = useQuery(leadCountsQuery({}));
  const due = counts?.byView.followup ?? 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  N
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Nelcota Leads</span>
                  <span className="truncate text-xs text-muted-foreground">Prospecção</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.to === "/" && due > 0 ? (
                      <SidebarMenuBadge title={`${due} retornos para hoje`}>{due}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UsageMeter />
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function UsageMeter() {
  const { data } = useQuery(providerStatusQuery);
  if (!data) return null;
  const { used, limit } = data.placesUsage;
  return (
    <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
      Google hoje: {used} de {limit} requisições
    </p>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Tema claro" : "Tema escuro";
  return (
    <SidebarMenuButton tooltip={label} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <SunIcon /> : <MoonIcon />}
      <span>{label}</span>
    </SidebarMenuButton>
  );
}

/**
 * The standard page frame: a header bar with the sidebar toggle, the title and the page
 * actions, then the content with consistent padding.
 */
export function Page({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <h1 className="truncate text-base font-medium">{title}</h1>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">{children}</div>
    </>
  );
}
