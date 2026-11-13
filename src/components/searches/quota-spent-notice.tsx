import { ClockIcon } from "lucide-react";

/** Amber border, no fill: today's Google quota is spent, new searches wait until tomorrow. */
export function QuotaSpentNotice() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-orange/45 px-4 py-3"
    >
      <ClockIcon aria-hidden strokeWidth={2} className="mt-0.5 size-[18px] shrink-0 text-orange" />
      <div>
        <p className="font-semibold">O limite de hoje acabou</p>
        <p className="text-sm text-muted-foreground">
          Dá para buscar de novo amanhã, a partir de 00:00. As buscas abaixo continuam abertas.
        </p>
      </div>
    </div>
  );
}
