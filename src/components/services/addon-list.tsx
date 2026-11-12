import { Button } from "@/components/ui/button";
import type { ServiceAddon } from "@/db/schema";
import { useRowEditor } from "@/hooks/use-row-editor";
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
  // The row being edited (an id, NEW for the add form, or none), guarded against lost edits.
  const rows = useRowEditor();
  const { editing, close } = rows;
  const save = (id: string | null) => (input: AddonInput) =>
    onSave(id, input, { onSuccess: close });

  return (
    <div className="grouped">
      {addons.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum adicional ainda.</p>
      ) : null}
      {addons.map((addon) =>
        editing === addon.id ? (
          <div key={addon.id} className="grouped-row [--inset:16px]">
            <AddonForm
              initial={addonToForm(addon)}
              busy={saving}
              onSave={save(addon.id)}
              onCancel={close}
              onDirtyChange={rows.reportDirty}
            />
          </div>
        ) : (
          <div
            key={addon.id}
            className="grouped-row flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 [--inset:16px]"
          >
            <span className="grid min-w-0 flex-1">
              <span className="font-medium">{addon.name}</span>
              <span className="text-xs text-muted-foreground">{addon.scope}</span>
            </span>
            <span className="font-medium tabular-nums">+ {priceLabel(addon)}</span>
            <span className="flex items-center gap-1">
              <Button size="sm" onClick={() => rows.open(addon.id)}>
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
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
            onDirtyChange={rows.reportDirty}
          />
        </div>
      ) : (
        <div className="px-4 pt-2.5 pb-3.5">
          <AddRowButton onClick={() => rows.open(NEW)}>Adicionar adicional</AddRowButton>
        </div>
      )}
      {rows.dialog}
    </div>
  );
}
