import type { Search } from "@/db/schema";
import { formatCount } from "@/lib/format";
import { searchDetails } from "@/lib/search-list";

/** "Ver detalhes da busca": the numbers the search already stores, under its row. */
export function SearchDetails({ search }: { search: Search }) {
  const details = searchDetails(search);
  const items = [
    { label: "Encontradas no Google", value: formatCount(details.foundOnGoogle) },
    { label: "Novas", value: formatCount(details.newCompanies) },
    { label: "Já existiam", value: formatCount(details.alreadyKnown) },
    { label: "Avaliadas pela IA", value: formatCount(details.analyzed) },
    { label: "Com erro", value: formatCount(details.failed) },
    { label: "Quantidade pedida", value: `até ${formatCount(details.requested)}` },
  ];
  return (
    <dl className="col-span-full grid grid-cols-2 gap-3 rounded-xl border border-border px-4 py-3.5 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
