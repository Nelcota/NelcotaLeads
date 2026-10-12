import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { CompassIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { RouteError } from "@/components/route-error";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_PAGES } from "@/lib/login";
import { applyThemeColor, THEME_COLOR, THEME_INIT_SCRIPT, useTheme } from "@/lib/theme";
import appCss from "../styles.css?url";

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
  shellComponent: RootDocument,
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
        {bare ? children : <AppShell>{children}</AppShell>}
        <Toaster position="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
