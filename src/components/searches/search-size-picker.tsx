import { SegmentedControl } from "@/components/notifications/segmented-control";
import { SEARCH_SIZES, type NewSearch } from "@/hooks/use-new-search";
import { searchCostLabel } from "@/lib/google-quota";

const OPTIONS = SEARCH_SIZES.map((size) => ({ value: String(size), label: `até ${size}` }));

/** How many companies to search, with what that costs against today's Google quota. */
export function SearchSizePicker({ newSearch }: { newSearch: NewSearch }) {
  const { form, maxResults, usage, statusLoading } = newSearch;
  const pick = (value: string) => {
    const size = SEARCH_SIZES.find((option) => String(option) === value);
    if (size === undefined) return;
    form.setValue("maxResults", size);
  };
  return (
    <div className="grid gap-2">
      <p aria-hidden className="text-sm font-medium">
        Quantas empresas
      </p>
      <SegmentedControl
        label="Quantas empresas"
        size="sm"
        value={String(maxResults)}
        options={OPTIONS}
        onChange={pick}
        className="max-w-sm"
      />
      {usage ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          {searchCostLabel(maxResults, usage)}
        </p>
      ) : null}
      {statusLoading ? <p className="text-sm text-muted-foreground">Carregando a cota…</p> : null}
    </div>
  );
}
