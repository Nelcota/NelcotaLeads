import { MessageCircleIcon } from "@/components/icons";
import { CATEGORY_LABELS } from "@/lib/notifications";

/** A sample of what reaches the bell, so "Notificações" shows what it is about. */
export function NotificationExample() {
  return (
    <div
      aria-label="Exemplo de aviso"
      className="flex max-w-90 items-start gap-2.5 rounded-xl bg-window px-3 py-2.5"
    >
      <MessageCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-orange" />
      <span className="grid">
        <span className="text-sm font-medium">Clínica Bem Viver respondeu</span>
        <span className="text-sm text-muted-foreground">{CATEGORY_LABELS.replies} · há 2 min</span>
      </span>
    </div>
  );
}
