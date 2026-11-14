import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon, MoonIcon, SunIcon, UserIcon } from "@/components/icons";
import { useRef } from "react";
import { Avatar } from "@/components/apple-ui";
import { isOnPage } from "@/components/sidebar/sidebar-nav-item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebarStatus } from "@/hooks/use-sidebar-status";
import { accountQuery } from "@/lib/queries";
import { SIDEBAR_STATUS_LABEL, statusNeedsAction, type SidebarStatus } from "@/lib/sidebar-status";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Dot color per status: orange asks for action, green is fine, neutral when unknown. */
const DOT_CLASS: Record<SidebarStatus, string> = {
  loading: "bg-fill",
  unavailable: "bg-fill",
  mail: "bg-orange",
  system: "bg-orange",
  ok: "bg-green",
};

/**
 * Top of the sidebar: the product, who is signed in and a status dot. It opens the account
 * menu (Minha conta, theme, Sair), so the footer keeps only the status card and two links.
 */
export function WorkspaceMenu() {
  const { data: account, isError: accountFailed } = useQuery(accountQuery);
  const { data: provider, status } = useSidebarStatus();
  // Conta left the page links: the menu that leads there marks it instead. Selecting the boolean
  // re-renders the menu only when entering or leaving Conta, not on every navigation.
  const onAccountPage = useRouterState({
    select: (state) => isOnPage(state.location.pathname, "/conta"),
  });
  const { theme, setTheme } = useTheme();
  const logoutForm = useRef<HTMLFormElement>(null);
  const statusLabel = SIDEBAR_STATUS_LABEL[status];
  const warn = statusNeedsAction(status);
  const dark = theme === "dark";
  const name = account?.name ?? "Sua conta";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              // Folded, the card is hidden: the tooltip says what the dot means.
              tooltip={statusLabel ? `Nelcota Leads · ${statusLabel}` : "Nelcota Leads"}
              isActive={onAccountPage}
              aria-current={onAccountPage ? "page" : undefined}
              className="h-14 gap-2.5 rounded-[12px] px-2 hover:bg-fill-2 hover:text-foreground active:bg-fill active:text-foreground data-[state=open]:text-foreground data-active:bg-fill data-active:shadow-none data-active:text-foreground data-active:hover:bg-fill data-active:hover:text-foreground data-[state=open]:bg-fill-2 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-1!"
            >
              <span className="relative grid aspect-square size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-base font-bold text-primary-foreground">
                N
                <span
                  data-testid={provider?.systemAttention ? "system-attention" : undefined}
                  aria-hidden
                  className={cn(
                    "absolute -right-[3px] -bottom-[3px] size-2.5 rounded-full ring-2 ring-sidebar",
                    DOT_CLASS[status],
                  )}
                />
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-lg font-bold">Nelcota Leads</span>
                <AccountEmail email={account?.email} failed={accountFailed} />
                {statusLabel ? <span className="sr-only">{statusLabel}</span> : null}
              </span>
              <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-tertiary" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-60">
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <Avatar name={name} src={account?.avatar} size={32} />
              <div className="grid min-w-0 leading-tight">
                <span className="truncate text-sm font-semibold">{name}</span>
                <span
                  className={cn("truncate text-xs", warn ? "text-orange" : "text-muted-foreground")}
                >
                  {statusLabel ?? " "}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/conta">
                <UserIcon aria-hidden />
                Minha conta
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme(dark ? "light" : "dark")}>
              {dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
              {dark ? "Tema claro" : "Tema escuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logoutForm.current?.requestSubmit()}>
              <LogOutIcon aria-hidden />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Sair posts like the button in Conta; the form lives outside the menu's portal. */}
        <form ref={logoutForm} method="post" action="/api/logout" hidden />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** The signed-in e-mail under the product name; a placeholder while it loads, a note if it fails. */
function AccountEmail({ email, failed }: { email: string | undefined; failed: boolean }) {
  if (email) {
    return <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>;
  }
  if (failed) {
    return (
      <span className="truncate text-xs font-normal text-muted-foreground">Conta indisponível</span>
    );
  }
  return <Skeleton className="mt-1 h-3 w-32" />;
}
