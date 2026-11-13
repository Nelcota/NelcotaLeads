import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewSearch } from "@/hooks/use-new-search";

/** Nicho and Cidade, side by side when there is room: shared by the Buscas page and the dialog. */
export function SearchFormFields({
  newSearch,
  idPrefix = "search",
  disabled = false,
  autoFocus = false,
}: {
  newSearch: NewSearch;
  /** Keeps ids unique when the dialog opens over the Buscas page. */
  idPrefix?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { form, errors } = newSearch;
  const fieldError = errors.niche?.message ?? errors.city?.message;
  return (
    <div className="grid gap-2">
      <div className="grid gap-3 @lg:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-niche`}>Nicho</Label>
          <Input
            id={`${idPrefix}-niche`}
            autoFocus={autoFocus}
            autoComplete="off"
            enterKeyHint="next"
            placeholder="Ex.: dentistas"
            disabled={disabled}
            aria-invalid={Boolean(errors.niche)}
            {...form.register("niche")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-city`}>Cidade</Label>
          <Input
            id={`${idPrefix}-city`}
            autoComplete="address-level2"
            enterKeyHint="search"
            placeholder="Ex.: Belo Horizonte"
            disabled={disabled}
            aria-invalid={Boolean(errors.city)}
            {...form.register("city")}
          />
        </div>
      </div>
      {fieldError ? <p className="text-sm text-red">{fieldError}</p> : null}
    </div>
  );
}
