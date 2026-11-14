import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { SETTINGS_TABS, type SettingsTab } from "@/lib/settings-tabs";
import { cn } from "@/lib/utils";

/**
 * The five Configurações tabs as links (`?aba=`), so each one can be shared and Back returns to
 * the previous tab. Same pill as `ChoicePill`; on a phone the row scrolls sideways.
 */
function revealTab(element: HTMLAnchorElement | null) {
  element?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function SettingsTabs({ current }: { current: SettingsTab }) {
  return (
    <nav
      aria-label="Seções de Configurações"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0"
    >
      <ul className="flex w-max gap-2 lg:w-auto lg:flex-wrap">
        {SETTINGS_TABS.map((tab) => {
          const selected = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                // On a phone the open tab may sit past the edge: bring it into view.
                ref={selected ? revealTab : undefined}
                to="/settings"
                search={{ aba: tab.id }}
                aria-current={selected ? "page" : undefined}
                className={cn(buttonVariants({ variant: selected ? "default" : "outline" }))}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
