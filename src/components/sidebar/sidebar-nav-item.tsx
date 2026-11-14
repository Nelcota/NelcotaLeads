import { Link } from "@tanstack/react-router";
import type { IconComponent } from "@/components/icons";
import type { ReactNode } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export type NavPath =
  | "/"
  | "/leads"
  | "/conversas"
  | "/agenda"
  | "/searches"
  | "/equipe"
  | "/settings";

export type NavItem = {
  to: NavPath;
  label: string;
  icon: IconComponent;
};

/**
 * One look for every sidebar row: 44px tall, the active page on a neutral fill (the blue accent
 * stays for the one main action of each page), centered in icon mode.
 */
export const ITEM_CLASS =
  "h-11 gap-3 rounded-[12px] px-3.5 text-base text-muted-foreground hover:bg-fill-2 hover:text-foreground active:bg-fill active:text-foreground data-active:bg-fill data-active:font-semibold data-active:text-foreground data-active:shadow-none data-active:hover:bg-fill data-active:hover:text-foreground group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:sr-only";

/** Whether `pathname` is the page `to` or one below it ("/settings/servicos" is in "/settings"). */
export function isOnPage(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** A link row of the sidebar; `badge` sits on the right edge of the row. */
export function SidebarNavItem({
  item,
  active,
  badge,
}: {
  item: NavItem;
  active: boolean;
  badge?: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={ITEM_CLASS}>
        <Link to={item.to} aria-current={active ? "page" : undefined}>
          <item.icon aria-hidden className="size-[18px]!" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {badge}
    </SidebarMenuItem>
  );
}
