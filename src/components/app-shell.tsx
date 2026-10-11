import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  HistoryIcon,
  MoonIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  SunIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { providerStatusQuery } from "@/lib/queries";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV: { to: "/" | "/searches" | "/settings"; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Leads", icon: UsersIcon },
  { to: "/searches", label: "Buscas", icon: HistoryIcon },
  { to: "/settings", label: "Configurações", icon: SlidersHorizontalIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar />
      <MobileTopBar />
      <main className="min-w-0 px-4 pt-6 pb-28 sm:px-8 lg:px-12 lg:pt-12 lg:pb-16">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <MobileTabBar />
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="text-[16px] font-medium tracking-tight">
      Nelcota <span className="text-muted-foreground">Leads</span>
    </Link>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <Button asChild className="mt-8 h-9 w-full justify-start gap-2 px-3">
        <Link to="/searches/new">
          <PlusIcon /> Nova busca
        </Link>
      </Button>
      <nav className="mt-6 grid gap-0.5" aria-label="Principal">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.to === "/" }}
            className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-muted data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            <item.icon className="size-4 opacity-70 group-data-[status=active]:opacity-100" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto grid gap-4">
        <UsageMeter />
        <ThemeToggle className="justify-start" />
      </div>
    </aside>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
      <Brand />
      <div className="flex items-center gap-1">
        <ThemeToggle iconOnly />
        <Button asChild size="sm">
          <Link to="/searches/new">
            <PlusIcon /> Nova busca
          </Link>
        </Button>
      </div>
    </header>
  );
}

function MobileTabBar() {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.to === "/" }}
          className="flex flex-col items-center gap-1 py-2.5 text-[12px] text-muted-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
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
  const ratio = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <div className="px-3 text-xs text-muted-foreground">
      <p className="flex justify-between">
        <span>Google hoje</span>
        <span className="tabular-nums">
          {used} de {limit}
        </span>
      </p>
      <div className="mt-2 h-px bg-border">
        <div
          className={cn("h-px", ratio >= 1 ? "bg-destructive" : "bg-foreground/60")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function ThemeToggle({ iconOnly, className }: { iconOnly?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const label = theme === "dark" ? "Tema claro" : "Tema escuro";
  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      aria-label={label}
      className={cn("text-muted-foreground", className)}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon />
      {iconOnly ? null : label}
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
        <h1 className="text-[28px] leading-tight font-medium tracking-tight sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
