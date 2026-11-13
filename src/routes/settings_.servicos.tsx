import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "@/components/icons";
import { Page } from "@/components/app-shell";
import { LeaveGuard } from "@/components/leave-guard";
import { AddonList } from "@/components/services/addon-list";
import { PriceDecisionCard } from "@/components/services/price-decision-card";
import { ServiceList } from "@/components/services/service-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useServiceTable } from "@/hooks/use-service-table";
import { pageTitle } from "@/lib/page-title";
import { serviceTableQuery } from "@/lib/queries";
import { usesExamplePrices } from "@/lib/services";

export const Route = createFileRoute("/settings_/servicos")({
  head: () => ({ meta: [{ title: pageTitle("Serviços e preços") }] }),
  // Never fails the page: the section shows its own error.
  loader: ({ context }) => context.queryClient.prefetchQuery(serviceTableQuery),
  component: ServicesPage,
});

function BackLink() {
  return (
    <Link
      to="/settings"
      className="inline-flex items-center gap-1 self-start px-1 text-sm font-medium text-blue hover:underline"
    >
      <ChevronLeftIcon className="size-4" />
      Configurações
    </Link>
  );
}

function ServicesPage() {
  const actions = useServiceTable();
  const { table } = actions;
  return (
    // Leaving with a changed row open asks "Descartar alterações?" first.
    <LeaveGuard>
      <Page title="Serviços e preços">
        <div className="mx-auto grid w-full max-w-[720px] gap-6">
          <BackLink />
          {table && usesExamplePrices(table.services, table.addons) ? (
            <p className="rounded-[14px] bg-orange/14 px-4 py-3 text-sm font-medium text-orange">
              Os preços abaixo são exemplos. A tabela real ainda vai ser definida.
            </p>
          ) : null}
          <PriceDecisionCard />
          {table ? (
            <>
              <TableSection
                title="Serviços"
                description="O preço base de cada serviço. A proposta copia os valores no momento em que é montada; mudar aqui não altera propostas já feitas."
              >
                <ServiceList
                  services={table.services}
                  saving={actions.savingService}
                  archiving={actions.archiving}
                  onSave={actions.saveService}
                  onArchive={actions.archiveService}
                />
              </TableSection>
              <TableSection
                title="Adicionais"
                description="Extras que o cliente pode pedir; cada um soma ao preço base. Pedidos fora desta lista entram na proposta como “Pedido do cliente”."
              >
                <AddonList
                  addons={table.addons}
                  saving={actions.savingAddon}
                  archiving={actions.archiving}
                  onSave={actions.saveAddon}
                  onArchive={actions.archiveAddon}
                />
              </TableSection>
            </>
          ) : actions.loadError ? (
            <p className="px-1 text-sm text-red">
              Não foi possível carregar a tabela. Atualize a página.
            </p>
          ) : (
            <Skeleton className="h-64 w-full rounded-[20px]" />
          )}
        </div>
      </Page>
    </LeaveGuard>
  );
}

function TableSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="enter">
      <h2 className="px-1.5 pb-2 text-lg font-semibold tracking-[-0.015em]">{title}</h2>
      {children}
      <p className="px-4 pt-2 text-xs leading-relaxed text-tertiary">{description}</p>
    </section>
  );
}
