import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MoonIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  SunIcon,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { NewSearchDialog } from "@/components/new-search-dialog";
import { Button } from "@/components/ui/button";
import { leadCountsQuery, providerStatusQuery } from "@/lib/queries";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV: {
  to: "/" | "/leads" | "/searches" | "/settings";
  label: string;
  icon: LucideIcon;
}[] = [
  { to: "/", label: "Painel", icon: LayoutDashboardIcon },
  { to: "/leads", label: "Leads", icon: InboxIcon },
  { to: "/searches", label: "Buscas", icon: HistoryIcon },
  { to: "/settings", label: "Configurações", icon: SlidersHorizontalIcon },
];

const NewSearchContext = createContext<() => void>(() => {});

/** Opens the "Nova busca" dialog from anywhere in the app. */
export function useOpenNewSearch() {
  return useContext(NewSearchContext);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [newSearchOpen, setNewSearchOpen] = useState(false);
  return (
    <NewSearchContext value={() => setNewSearchOpen(true)}>
      <div className="flex h-dvh flex-col">
        <TopBar onNewSearch={() => setNewSearchOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <MobileTabBar />
      </div>
      <NewSearchDialog open={newSearchOpen} onOpenChange={setNewSearchOpen} />
    </NewSearchContext>
  );
}

function TopBar({ onNewSearch }: { onNewSearch: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-8 border-b px-4 sm:px-6">
      <Link to="/" className="text-[16px] font-medium tracking-tight">
        Nelcota <span className="text-muted-foreground">Leads</span>
      </Link>
      <nav className="hidden h-full items-stretch gap-6 md:flex" aria-label="Principal">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/", includeSearch: false }}
            className="relative flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-px data-[status=active]:after:h-0.5 data-[status=active]:after:bg-foreground"
          >
            {item.label}
            {item.to === "/" ? <FollowUpCount /> : null}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <UsageMeter />
        <ThemeToggle />
        <Button size="sm" variant="outline" onClick={onNewSearch}>
          <PlusIcon /> Busca manual
        </Button>
      </div>
    </header>
  );
}

/** Follow-ups due today, so the nav says when there is something to come back to. */
function FollowUpCount() {
  const { data } = useQuery(leadCountsQuery({}));
  const due = data?.byView.followup ?? 0;
  if (due === 0) return null;
  return (
    <span
      className="rounded-full bg-brand px-1.5 text-xs leading-5 font-medium text-white tabular-nums"
      title={`${due} para retornar hoje`}
    >
      {due}
    </span>
  );
}

function MobileTabBar() {
  return (
    <nav
      aria-label="Principal"
      className="grid shrink-0 grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/", includeSearch: false }}
          className="flex flex-col items-center gap-1 py-2 text-[12px] font-medium text-muted-foreground data-[status=active]:text-foreground"
        >
          <item.icon className="size-5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function UsageMeter() {
  const { data } = useQuery(providerStatusQuery);
  if (!data) return null;
  const { used, limit } = data.placesUsage;
  return (
    <span
      className={cn(
        "hidden text-xs tabular-nums sm:inline",
        used >= limit ? "text-destructive" : "text-muted-foreground",
      )}
      title="Requisições ao Google Places hoje"
    >
      Google {used}/{limit}
    </span>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const label = theme === "dark" ? "Tema claro" : "Tema escuro";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className="text-muted-foreground"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon />
    </Button>
  );
}

/** Padded, centered column for the simple pages (Buscas, Configurações). */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-4xl px-4 pt-8 pb-16 sm:px-8 lg:pt-12", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <h1 className="text-[28px] leading-tight font-medium tracking-tight sm:text-[32px]">
        {title}
      </h1>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
