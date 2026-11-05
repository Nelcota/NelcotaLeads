import type { AgendaTile } from "@/lib/agenda";
import { cn } from "@/lib/utils";

const TONE_CLASS = { blue: "text-blue", orange: "text-orange" } as const;

/** The summary over the list: each tile a number and what it counts. */
export function AgendaTiles({ tiles }: { tiles: readonly AgendaTile[] }) {
  return (
    <section aria-label="Resumo da agenda" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="grouped enter grid gap-1 p-4">
          <h2 className="text-[13px] font-semibold text-muted-foreground">{tile.label}</h2>
          <p
            className={cn(
              "text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums",
              tile.tone && TONE_CLASS[tile.tone],
            )}
          >
            {tile.value}
          </p>
          <p className="text-xs text-muted-foreground">{tile.caption}</p>
        </div>
      ))}
    </section>
  );
}
