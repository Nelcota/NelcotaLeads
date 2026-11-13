import { EyeIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EmptyKind = "none" | "all-hidden" | "filtered";

/**
 * What the Histórico says when it has no rows: no search yet, every search hidden (with the way
 * back to them), or nothing in the chosen filter.
 */
export function SearchHistoryEmpty({
  kind,
  onShowAll,
  onShowHidden,
}: {
  kind: EmptyKind;
  onShowAll: () => void;
  onShowHidden: () => void;
}) {
  if (kind === "filtered") {
    return (
      <div className="grid justify-items-center gap-2 px-5 py-10 text-center">
        <p className="font-semibold">Nenhuma busca neste filtro</p>
        <Button variant="ghost" size="sm" onClick={onShowAll}>
          Ver todas
        </Button>
      </div>
    );
  }
  if (kind === "all-hidden") {
    return (
      <div className="grid justify-items-center gap-2 px-5 py-10 text-center">
        <p className="font-semibold">Todas as buscas estão ocultas</p>
        <p className="text-sm text-muted-foreground">
          Elas continuam guardadas, assim como os leads delas.
        </p>
        <Button variant="outline" size="sm" onClick={onShowHidden}>
          <EyeIcon />
          Mostrar buscas ocultas
        </Button>
      </div>
    );
  }
  return (
    <div className="grid justify-items-center gap-2 px-5 py-12 text-center">
      <SearchIcon aria-hidden strokeWidth={1.8} className="size-6 text-muted-foreground" />
      <p className="font-semibold">Nenhuma busca ainda</p>
      <p className="max-w-md text-sm text-pretty text-muted-foreground">
        As buscas diárias e as que você fizer aparecem aqui.
      </p>
    </div>
  );
}
