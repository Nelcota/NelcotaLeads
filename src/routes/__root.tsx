import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { CompassIcon } from "lucide-react";
import { EmptyState } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/route-error";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_PAGES } from "@/lib/login";
import { readSidebarOpen } from "@/lib/sidebar-state";
import { applyThemeColor, THEME_COLOR, THEME_INIT_SCRIPT, useTheme } from "@/lib/theme";
import appCss from "../styles.css?url";

/**
 * The AppShell is loaded on demand: the sign-in screens never download the sidebar and all it
 * pulls in. The router preloads it (RootOutlet.preload) before rendering any other page, also
 * before hydration, so the shell renders at once; the lazy fallback only covers a client-side
 * visit coming from a sign-in screen.
 */
type AppShellComponent = typeof import("@/components/app-shell").AppShell;
let loadedShell: AppShellComponent | undefined;
let shellImport: Promise<AppShellComponent> | undefined;

function loadShell() {
  shellImport ??= import("@/components/app-shell").then((module) => {
    loadedShell = module.AppShell;
    return module.AppShell;
  });
  return shellImport;
}

const LazyAppShell = lazy(() => loadShell().then((AppShell) => ({ default: AppShell })));

function RootOutlet() {
  return <Outlet />;
}
RootOutlet.preload = async () => {
  if (typeof window !== "undefined" && AUTH_PAGES.has(window.location.pathname)) return;
  await loadShell();
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "dark light" },
      { name: "apple-mobile-web-app-title", content: "Nelcota" },
      { title: "Nelcota Leads" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  // "Recolher menu" survives a reload: the sidebar's own cookie, read before the first paint.
  loader: async () => ({ sidebarOpen: await readSidebarOpen() }),
  shellComponent: RootDocument,
  component: RootOutlet,
  errorComponent: RouteError,
  notFoundComponent: () => (
    <div className="grid min-h-full place-items-center p-6">
      <EmptyState
        icon={CompassIcon}
        className="grouped w-full max-w-md"
        title="Página não encontrada"
        description="O endereço não existe ou foi removido."
      >
        <Button asChild variant="outline">
          <Link to="/">Ir para o painel</Link>
        </Button>
      </EmptyState>
    </div>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  // The sign-in screens stand alone: no sidebar, and nothing that queries the (gated) server.
  const bare = useRouterState({ select: (state) => AUTH_PAGES.has(state.location.pathname) });
  const { theme } = useTheme();
  useEffect(() => applyThemeColor(theme), [theme]);
  const sidebarOpen = Route.useLoaderData({ select: (data) => data?.sidebarOpen ?? true });
  const Shell = loadedShell;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* oxlint-disable-next-line react/no-danger -- static, inlined theme bootstrap */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Here, not in `head`: HeadContent keeps one meta per name, and these are two. */}
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLOR.dark} />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={THEME_COLOR.light}
        />
        <HeadContent />
      </head>
      <body>
        {bare ? (
          children
        ) : Shell ? (
          <Shell sidebarOpen={sidebarOpen}>{children}</Shell>
        ) : (
          <Suspense fallback={<div className="h-svh bg-background" />}>
            <LazyAppShell sidebarOpen={sidebarOpen}>{children}</LazyAppShell>
          </Suspense>
        )}
        <Toaster position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
