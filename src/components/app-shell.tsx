import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Hint, TONE_TEXT, type Tone } from "@/components/apple-ui";
import { HelpSheet } from "@/components/help-sheet";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NewSearchDialog } from "@/components/new-search-dialog";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNotificationAlerts } from "@/hooks/use-notification-alerts";
import { useNotifications } from "@/hooks/use-notifications";
import { isHelpKey } from "@/lib/help";
import { withAttentionCount } from "@/lib/page-title";
import { attentionQuery } from "@/lib/queries";
import { isTypingTarget } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** Target of the "Pular para o conteúdo" link: the page area beside the menu. */
const MAIN_CONTENT_ID = "conteudo";

const NewSearchContext = createContext<() => void>(() => {});

/** Opens the "Nova busca" dialog from anywhere in the app. */
export function useOpenNewSearch() {
  return useContext(NewSearchContext);
}

/** "?" (Shift + /) opens the help from any screen, except while the user types. */
function useHelpKey(open: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isHelpKey(event) || isTypingTarget(event.target)) return;
      event.preventDefault();
      open();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
}

/**
 * Keeps the "Precisa de você" count in front of the tab title on every page. The routes own
 * the title itself (their `head`), so the count is put back whenever a navigation rewrites it.
 */
function useAttentionTitle() {
  const { data: attention = 0 } = useQuery(attentionQuery);
  useEffect(() => {
    const apply = () => {
      const next = withAttentionCount(document.title, attention);
      if (next !== document.title) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = withAttentionCount(document.title, 0);
    };
  }, [attention]);
}

export function AppShell({
  children,
  sidebarOpen = true,
}: {
  children: ReactNode;
  /** Whether the menu starts open: what the Menu button or Ctrl+B left in its cookie. */
  sidebarOpen?: boolean;
}) {
  const [newSearchOpen, setNewSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  useAttentionTitle();
  useHelpKey(openHelp);
  useNotificationAlerts(useNotifications());
  return (
    <NewSearchContext value={() => setNewSearchOpen(true)}>
      <TooltipProvider delayDuration={300}>
        {/* First stop of the Tab key: jumps over the menu straight to the page. */}
        <a
          href={`#${MAIN_CONTENT_ID}`}
          className="sr-only rounded-lg border border-border bg-popover px-3 py-2 text-sm font-medium text-foreground shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Pular para o conteúdo
        </a>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <AppSidebar onNewSearch={() => setNewSearchOpen(true)} onOpenHelp={openHelp} />
          {/* Same background as the sidebar; a thin left outline separates the pages
                from the menu and the panel reaches the top edge, with no gap above. */}
          <SidebarInset
            id={MAIN_CONTENT_ID}
            tabIndex={-1}
            className="h-svh overflow-hidden outline-none md:border-l md:border-border"
          >
            {children}
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
      <NewSearchDialog open={newSearchOpen} onOpenChange={setNewSearchOpen} />
      <HelpSheet open={helpOpen} onOpenChange={setHelpOpen} />
    </NewSearchContext>
  );
}

/**
 * The standard page frame beside the sidebar, on the same background: a toolbar with the large title
 * and the page actions, an optional summary line, then the scrolling content.
 */
export function Page({
  title,
  titleAside,
  description,
  actions,
  bleed = false,
  children,
}: {
  title: string;
  /** Sits right after the title (the Conversas filters). */
  titleAside?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Full-height content without padding (Conversas). */
  bleed?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {/* The same scrollbar gutter as the content below, so the header actions end where the
          cards end, whatever the scrollbar width. */}
      <header
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 px-4 sm:h-16 lg:px-6",
          !bleed && "overflow-hidden [scrollbar-gutter:stable]",
        )}
      >
        <Hint label="Menu">
          <SidebarTrigger
            aria-label="Mostrar ou esconder o menu"
            className="-ml-1 size-9 text-tertiary"
          />
        </Hint>
        <h1
          className={cn(
            "min-w-0 truncate text-lg font-semibold tracking-[-0.02em] sm:text-2xl",
            titleAside ? "shrink-0" : "flex-1",
          )}
        >
          {title}
        </h1>
        {titleAside ? <div className="min-w-0 flex-1 pl-4">{titleAside}</div> : null}
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        <NotificationBell />
      </header>
      {bleed ? (
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      ) : (
        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 pt-1 pb-12 lg:px-6">
            {description ? (
              <p className="-mt-1 text-base text-muted-foreground">{description}</p>
            ) : null}
            {children}
          </div>
        </div>
      )}
    </>
  );
}

/** A number in the summary line, colored by what it means; `one` is the label for exactly 1. */
export function Stat({
  value,
  tone,
  one,
  children,
}: {
  value: number;
  tone?: Tone;
  one?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={cn(tone && TONE_TEXT[tone])}>
      <b className={cn("font-medium tabular-nums", !tone && "text-foreground")}>{value}</b>{" "}
      {value === 1 && one !== undefined ? one : children}
    </span>
  );
}
