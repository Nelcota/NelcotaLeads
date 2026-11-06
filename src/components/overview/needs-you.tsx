import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/apple-ui";
import { nicheAndCity, waitingLabel } from "@/lib/overview";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/server/dashboard";

/** Conversations the AI handed over: who, why, and for how long they have been waiting. */
export function NeedsYou({ data, now }: { data: Dashboard; now: Date }) {
  if (data.attention.length === 0) return null;
  return (
    <section aria-labelledby="needs-you" className="grouped enter">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 pt-4 pb-2">
        <h2 id="needs-you" className="text-[17px] font-semibold text-orange">
          Precisa de você
        </h2>
        <span className="rounded-full bg-orange/16 px-2 py-px text-xs font-bold text-orange tabular-nums">
          {data.stats.interested}
        </span>
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">
          A IA parou e passou a conversa para você.
        </span>
        <Link
          to="/conversas"
          search={{ filter: "needsYou" }}
          className="text-[13.5px] font-semibold text-blue hover:underline"
        >
          Ver todas
        </Link>
      </div>
      {data.attention.slice(0, 5).map((lead) => {
        // Same rule as the "sem resposta há mais de 1 dia" alert, decided by the server.
        const late = lead.late;
        const where = nicheAndCity(lead.niche, lead.city);
        return (
          <Link
            key={lead.id}
            to="/conversas"
            search={{ lead: lead.id }}
            className="flex min-h-[60px] items-center gap-3 border-t border-border/60 px-5 py-2.5 transition-colors outline-none hover:bg-fill-3 focus-visible:bg-fill-2"
          >
            <Avatar name={lead.name} size={36} square />
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-semibold">{lead.name}</span>
              <span className="truncate text-[13px] text-muted-foreground">
                {lead.handoffReason ?? "Respondeu"}
                {where ? ` · ${where}` : ""}
              </span>
            </span>
            {lead.lastInboundAt ? (
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold tabular-nums",
                  late ? "bg-red/14 text-red" : "bg-fill-2 text-muted-foreground",
                )}
              >
                {waitingLabel(lead.lastInboundAt, now)}
              </span>
            ) : null}
            <span className="shrink-0 text-[13.5px] font-semibold text-blue max-sm:hidden">
              Responder
            </span>
          </Link>
        );
      })}
    </section>
  );
}
