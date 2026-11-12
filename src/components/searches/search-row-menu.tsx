import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  MapPinIcon,
  PencilLineIcon,
} from "lucide-react";
import { useRef } from "react";
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
  // Filled once the menu has closed: closing hands focus back to ⋯, so the form field would
  // lose the focus it was just given.
  const pendingFill = useRef<[string, string] | null>(null);
  const fillAfterClose = (event: Event) => {
    const fill = pendingFill.current;
    if (!fill) return;
    event.preventDefault();
    pendingFill.current = null;
    onFill(fill[0], fill[1]);
  };
  return (
    <DropdownMenu>
      <Hint label="Mais ações">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Mais ações">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-60"
        onCloseAutoFocus={fillAfterClose}
      >
        <DropdownMenuItem onSelect={() => (pendingFill.current = [search.niche, search.city])}>
          <PencilLineIcon />
          Usar nicho e cidade
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => (pendingFill.current = [search.niche, ""])}>
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
