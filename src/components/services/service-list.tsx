import { Button } from "@/components/ui/button";
import type { Service } from "@/db/schema";
import { useRowEditor } from "@/hooks/use-row-editor";
import { EMPTY_SERVICE_FORM, serviceToForm } from "@/lib/service-form";
import { deadlineLabel, priceLabel, type ServiceInput } from "@/lib/services";
import { AddRowButton } from "./add-row-button";
import { ServiceForm } from "./service-form";

const NEW = "new";

/** The services: name and detail, base price, deadline or "mensal"; add, edit, archive. */
export function ServiceList({
  services,
  saving,
  archiving,
  onSave,
  onArchive,
}: {
  services: readonly Service[];
  saving: boolean;
  archiving: boolean;
  onSave: (id: string | null, input: ServiceInput, done: { onSuccess: () => void }) => void;
  onArchive: (id: string) => void;
}) {
  // The row being edited (a service id, NEW for the add form, or none), guarded against lost edits.
  const rows = useRowEditor();
  const { editing, close } = rows;
  const save = (id: string | null) => (input: ServiceInput) =>
    onSave(id, input, { onSuccess: close });

  return (
    <div className="grouped">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-4 pt-3 pb-1.5 text-xs font-medium text-muted-foreground max-sm:hidden">
        <span>Serviço</span>
        <span className="w-24 text-right">Preço base</span>
        <span className="w-[164px]">Prazo</span>
      </div>
      {services.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Nenhum serviço ainda. Adicione o primeiro para montar propostas.
        </p>
      ) : null}
      {services.map((service) =>
        editing === service.id ? (
          <div key={service.id} className="grouped-row [--inset:16px]">
            <ServiceForm
              initial={serviceToForm(service)}
              busy={saving}
              onSave={save(service.id)}
              onCancel={close}
              onDirtyChange={rows.reportDirty}
            />
          </div>
        ) : (
          <div
            key={service.id}
            className="grouped-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 [--inset:16px] sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <span className="grid min-w-0">
              <span className="font-medium">{service.name}</span>
              {service.detail ? (
                <span className="text-xs text-muted-foreground">{service.detail}</span>
              ) : null}
            </span>
            <span className="w-24 text-right font-medium tabular-nums">{priceLabel(service)}</span>
            <span className="flex items-center gap-1 max-sm:col-span-2 sm:w-[164px]">
              <span className="flex-1 text-sm text-muted-foreground">{deadlineLabel(service)}</span>
              <Button size="sm" onClick={() => rows.open(service.id)}>
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={archiving}
                onClick={() => onArchive(service.id)}
              >
                Arquivar
              </Button>
            </span>
          </div>
        ),
      )}
      {editing === NEW ? (
        <div className="grouped-row [--inset:16px]">
          <ServiceForm
            initial={EMPTY_SERVICE_FORM}
            busy={saving}
            onSave={save(null)}
            onCancel={close}
            onDirtyChange={rows.reportDirty}
          />
        </div>
      ) : (
        <div className="px-4 pt-2.5 pb-3.5">
          <AddRowButton onClick={() => rows.open(NEW)}>Adicionar serviço</AddRowButton>
        </div>
      )}
      {rows.dialog}
    </div>
  );
}
