import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ServiceAddon } from "@/db/schema";
import { addonToForm, EMPTY_ADDON_FORM } from "@/lib/service-form";
import { priceLabel, type AddonInput } from "@/lib/services";
import { AddonForm } from "./addon-form";
import { AddRowButton } from "./add-row-button";

const NEW = "new";

/** The extras a client may ask for, each added to the base price; add, edit, archive. */
export function AddonList({
  addons,
  saving,
  archiving,
  onSave,
  onArchive,
}: {
  addons: readonly ServiceAddon[];
  saving: boolean;
  archiving: boolean;
  onSave: (id: string | null, input: AddonInput, done: { onSuccess: () => void }) => void;
  onArchive: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const close = () => setEditing(null);
  const save = (id: string | null) => (input: AddonInput) =>
    onSave(id, input, { onSuccess: close });

  return (
    <div className="grouped">
      {addons.length === 0 ? (
        <p className="px-4 py-3 text-sm font-light text-muted-foreground">
          Nenhum adicional ainda.
        </p>
      ) : null}
      {addons.map((addon) =>
        editing === addon.id ? (
          <div key={addon.id} className="grouped-row [--inset:16px]">
            <AddonForm
              initial={addonToForm(addon)}
              busy={saving}
              onSave={save(addon.id)}
              onCancel={close}
            />
          </div>
        ) : (
          <div
            key={addon.id}
            className="grouped-row flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 [--inset:16px]"
          >
            <span className="grid min-w-0 flex-1">
              <span className="font-medium">{addon.name}</span>
              <span className="text-xs font-light text-muted-foreground">{addon.scope}</span>
            </span>
            <span className="font-medium tabular-nums">+ {priceLabel(addon)}</span>
            <span className="flex items-center gap-1">
              <Button size="xs" onClick={() => setEditing(addon.id)}>
                Editar
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="hover:bg-red/15 hover:text-red"
                disabled={archiving}
                onClick={() => onArchive(addon.id)}
              >
                Arquivar
              </Button>
            </span>
          </div>
        ),
      )}
      {editing === NEW ? (
        <div className="grouped-row [--inset:16px]">
          <AddonForm
            initial={EMPTY_ADDON_FORM}
            busy={saving}
            onSave={save(null)}
            onCancel={close}
          />
        </div>
      ) : (
        <div className="px-4 pt-2.5 pb-3.5">
          <AddRowButton onClick={() => setEditing(NEW)}>Adicionar adicional</AddRowButton>
        </div>
      )}
    </div>
  );
}
