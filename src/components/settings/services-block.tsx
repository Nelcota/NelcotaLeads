import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/format";
import { formatCents } from "@/lib/money";
import type { ServiceTable } from "@/server/service-store";
import { SettingsBlock } from "./settings-block";

/** "Serviços e preços": the table proposals come from, read-only here; edited on its own page. */
export function ServicesBlock({ table, failed }: { table: ServiceTable | null; failed: boolean }) {
  return (
    <SettingsBlock
      id="servicos"
      title="Serviços e preços"
      description="A tabela fixa de onde saem as propostas."
      action={
        <Link
          to="/settings/servicos"
          className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-blue hover:underline"
        >
          Abrir a tabela de serviços
          <ChevronRightIcon aria-hidden className="size-4" />
        </Link>
      }
    >
      <ServicesTable table={table} failed={failed} />
    </SettingsBlock>
  );
}

function ServicesTable({ table, failed }: { table: ServiceTable | null; failed: boolean }) {
  if (failed) {
    return (
      <p className="text-sm text-red">Não foi possível carregar a tabela. Atualize a página.</p>
    );
  }
  if (!table) return <Skeleton className="h-32 w-full" />;
  const rows = [
    ...table.services.map((row) => ({ ...row, addon: false })),
    ...table.addons.map((row) => ({ ...row, addon: true, deadlineDays: null })),
  ];
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado ainda.</p>;
  }
  return (
    <table className="w-full table-fixed text-left">
      <thead>
        <tr className="text-xs text-tertiary">
          <th scope="col" className="pb-2 font-medium">
            Serviço
          </th>
          <th scope="col" className="w-24 pb-2 text-right font-medium">
            Prazo
          </th>
          <th scope="col" className="w-32 pb-2 text-right font-medium">
            Preço
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.addon ? "addon" : "service"}-${row.id}`}
            className="border-t border-black/[0.06] dark:border-white/[0.06]"
          >
            <td className="truncate py-3">
              {row.name}
              {row.addon ? <span className="text-sm text-tertiary"> · adicional</span> : null}
            </td>
            <td className="py-3 text-right text-muted-foreground tabular-nums">
              {row.deadlineDays === null ? "—" : pluralize(row.deadlineDays, "dia", "dias")}
            </td>
            <td className="py-3 text-right tabular-nums">
              {formatCents(row.priceCents)}
              {row.monthly ? <span className="text-sm text-tertiary">/mês</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
