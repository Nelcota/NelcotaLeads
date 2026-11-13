import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  MapPinIcon,
  PencilLineIcon,
  RotateCwIcon,
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

/**
 * The ⋯ menu of a search that is not running: search it again, reuse it in the form, details,
 * hide or show. What needs today's quota is off once the quota is spent.
 */
export function SearchRowMenu({
  search,
  quotaSpent,
  detailsOpen,
  onToggleDetails,
  onFill,
  onRepeat,
  repeatPending,
}: {
  search: Search;
  quotaSpent: boolean;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onFill: (niche: string, city: string) => void;
  /** See SearchRowActions: the confirmation lives in the row, which outlives this menu. */
  onRepeat: () => void;
  repeatPending: boolean;
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
  const queueFill = (city: string) => {
    pendingFill.current = [search.niche, city];
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
        <DropdownMenuItem disabled={quotaSpent || repeatPending} onSelect={onRepeat}>
          <RotateCwIcon />
          Buscar de novo
        </DropdownMenuItem>
        <DropdownMenuItem disabled={quotaSpent} onSelect={() => queueFill(search.city)}>
          <PencilLineIcon />
          Usar nicho e cidade
        </DropdownMenuItem>
        <DropdownMenuItem disabled={quotaSpent} onSelect={() => queueFill("")}>
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
