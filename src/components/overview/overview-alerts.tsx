import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon, XIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { OverviewAlert } from "@/lib/overview";
import { cn } from "@/lib/utils";

const DISMISSED_KEY = "overview:dismissed-alerts";
const NONE = "[]";

// What was dismissed in this tab, for when sessionStorage is blocked (private mode).
let inMemory: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The stored list as text: a stable value for useSyncExternalStore. */
function readStored(): string {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) ?? inMemory ?? NONE;
  } catch {
    return inMemory ?? NONE;
  }
}

/** The server has no sessionStorage: it (and the first client render) shows every alert. */
const serverSnapshot = () => NONE;

function parseDismissed(stored: string): string[] {
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(keys: string[]) {
  inMemory = JSON.stringify(keys);
  try {
    sessionStorage.setItem(DISMISSED_KEY, inMemory);
  } catch {
    // Private mode or blocked storage: the alert only stays hidden until the page reloads.
  }
  for (const listener of listeners) listener();
}

/** Alerts at the top of the overview; each can be hidden for the rest of the browser session. */
export function OverviewAlerts({ alerts }: { alerts: OverviewAlert[] }) {
  const dismissed = parseDismissed(useSyncExternalStore(subscribe, readStored, serverSnapshot));
  const visible = alerts.filter((alert) => !dismissed.includes(alert.key));
  if (visible.length === 0) return null;

  const dismiss = (key: string) => writeDismissed([...dismissed, key]);

  return (
    <section aria-label="Alertas" className="enter grid gap-2">
      {visible.map((alert) => (
        <div
          key={alert.key}
          className={cn(
            "flex min-h-[52px] items-center gap-3 rounded-[16px] border border-border bg-card px-4 py-2.5",
          )}
        >
          <TriangleAlertIcon
            aria-hidden
            className={cn("size-4 shrink-0", alert.tone === "red" ? "text-red" : "text-orange")}
          />
          <span className="min-w-0 flex-1 text-[15px]">{alert.text}</span>
          <Link
            {...alert.link}
            className="shrink-0 text-[15px] font-semibold text-blue hover:underline"
          >
            {alert.action}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => dismiss(alert.key)}
            aria-label="Dispensar alerta"
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      ))}
    </section>
  );
}
