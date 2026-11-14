import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInlineField } from "@/hooks/use-inline-field";
import { SettingsRow } from "./settings-row";

/**
 * A settings row whose value turns into a field in place: "Editar" opens it with Cancelar and
 * Salvar, Esc cancels, Enter saves. Only this row changes; nothing else on the page opens.
 */
export function InlineEditRow({
  id,
  label,
  value,
  maxLength = 120,
  autoComplete,
  onSave,
  onDraftChange,
}: {
  id: string;
  label: string;
  value: string;
  maxLength?: number;
  autoComplete?: string;
  onSave: (value: string) => Promise<unknown>;
  onDraftChange?: (draft: string | null) => void;
}) {
  const field = useInlineField({ id, value, onSave, onDraftChange });
  const errorId = `${id}-error`;
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // When the field closes (Cancelar, Esc or a save), the keyboard lands back on "Editar".
  useEffect(() => {
    if (field.editing || !returnFocus.current) return;
    returnFocus.current = false;
    editButton.current?.focus();
  }, [field.editing]);

  const startEditing = () => {
    returnFocus.current = true;
    field.start();
  };

  if (!field.editing) {
    return (
      <SettingsRow
        label={label}
        action={
          <Button
            ref={editButton}
            variant="ghost"
            size="sm"
            onClick={startEditing}
            aria-label={`Editar ${label.toLowerCase()}`}
          >
            Editar
          </Button>
        }
      >
        {value || <span className="text-muted-foreground">Não informado</span>}
      </SettingsRow>
    );
  }

  return (
    <SettingsRow label={<label htmlFor={id}>{label}</label>}>
      <form
        noValidate
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void field.submit();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          field.cancel();
        }}
      >
        <Input
          id={id}
          autoFocus
          autoComplete={autoComplete}
          maxLength={maxLength}
          value={field.draft}
          onChange={(event) => field.type(event.target.value)}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={field.error ? errorId : undefined}
          className="min-w-0 flex-1 basis-48"
        />
        <Button type="button" variant="ghost" size="sm" onClick={field.cancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={field.saving}>
          {field.saving ? "Salvando…" : "Salvar"}
        </Button>
        {field.error ? (
          <p id={errorId} role="alert" className="basis-full text-sm text-red">
            {field.error}
          </p>
        ) : null}
      </form>
    </SettingsRow>
  );
}
