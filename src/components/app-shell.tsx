import { Link } from "@tanstack/react-router";
import { MoonIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

const NAV = [
  { to: "/", label: "Leads" },
  { to: "/searches", label: "Buscas" },
  { to: "/settings", label: "Configurações" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 sm:h-14 sm:flex-nowrap sm:py-0 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-[15px] font-medium tracking-tight whitespace-nowrap"
          >
            <span className="inline-block size-2.5 rounded-full bg-brand" />
            Nelcota Leads
          </Link>
          <nav className="-mx-2.5 order-last flex w-full items-center gap-1 overflow-x-auto text-sm sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="relative rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground data-[status=active]:after:absolute data-[status=active]:after:inset-x-2.5 data-[status=active]:after:-bottom-[11px] data-[status=active]:after:h-px data-[status=active]:after:bg-foreground max-sm:data-[status=active]:after:hidden"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm">
              <Link to="/searches/new">Nova busca</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-medium tracking-tight sm:text-[28px]">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed font-light text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
