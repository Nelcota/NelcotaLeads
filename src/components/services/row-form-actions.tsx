import { Button } from "@/components/ui/button";

/** The error (if any) and "Salvar" / "Cancelar" under a row being edited. */
export function RowFormActions({
  error,
  busy,
  onCancel,
}: {
  error: string | null;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      {error ? (
        <p role="alert" className="text-[14px] text-red">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </>
  );
}
