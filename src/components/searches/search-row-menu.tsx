import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  MapPinIcon,
  PencilLineIcon,
} from "lucide-react";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Search } from "@/db/schema";
import { useHideSearch, useUnhideSearch } from "@/hooks/use-search-actions";

/** The ⋯ menu of a search that is not running: reuse it in the form, details, hide or show. */
export function SearchRowMenu({
  search,
  detailsOpen,
  onToggleDetails,
  onFill,
}: {
  search: Search;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onFill: (niche: string, city: string) => void;
}) {
  const hide = useHideSearch();
  const unhide = useUnhideSearch();
  const hidden = search.hiddenAt !== null;
  return (
    <DropdownMenu>
      <Hint label="Mais ações">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" className="w-auto min-w-60">
        <DropdownMenuItem onSelect={() => onFill(search.niche, search.city)}>
          <PencilLineIcon />
          Usar nicho e cidade
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onFill(search.niche, "")}>
          <MapPinIcon />
          Mesmo nicho em outra cidade
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onToggleDetails}>
          <InfoIcon />
          {detailsOpen ? "Esconder detalhes" : "Ver detalhes da busca"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {hidden ? (
          <DropdownMenuItem disabled={unhide.isPending} onSelect={() => unhide.mutate(search.id)}>
            <EyeIcon />
            Mostrar na lista
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={hide.isPending} onSelect={() => hide.mutate(search.id)}>
            <EyeOffIcon />
            Ocultar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
