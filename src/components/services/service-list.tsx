import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Service } from "@/db/schema";
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
  // The row being edited: a service id, NEW for the add form, or none.
  const [editing, setEditing] = useState<string | null>(null);
  const close = () => setEditing(null);
  const save = (id: string | null) => (input: ServiceInput) =>
    onSave(id, input, { onSuccess: close });

  return (
    <div className="grouped">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-4 pt-3 pb-1.5 text-xs font-medium text-muted-foreground max-sm:hidden">
        <span>Serviço</span>
        <span className="w-24 text-right">Preço base</span>
        <span className="w-[136px]">Prazo</span>
      </div>
      {services.length === 0 ? (
        <p className="px-4 py-3 text-sm font-light text-muted-foreground">
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
                <span className="text-xs font-light text-muted-foreground">{service.detail}</span>
              ) : null}
            </span>
            <span className="w-24 text-right font-medium tabular-nums">{priceLabel(service)}</span>
            <span className="flex items-center gap-1 max-sm:col-span-2 sm:w-[136px]">
              <span className="flex-1 text-sm text-muted-foreground">{deadlineLabel(service)}</span>
              <Button variant="ghost" size="xs" onClick={() => setEditing(service.id)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="hover:bg-red/15 hover:text-red"
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
          />
        </div>
      ) : (
        <div className="px-4 pt-2.5 pb-3.5">
          <AddRowButton onClick={() => setEditing(NEW)}>Adicionar serviço</AddRowButton>
        </div>
      )}
    </div>
  );
}
