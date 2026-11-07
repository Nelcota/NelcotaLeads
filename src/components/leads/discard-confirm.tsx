import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** From this many leads at once, "Descartar" asks first; fewer are discarded with "Desfazer". */
export const DISCARD_CONFIRM_FROM = 3;

/** "Descartar N leads?" before a large discard. Keeping them is the default answer. */
export function DiscardConfirm({
  open,
  count,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** Leads waiting for the answer; kept while the dialog closes so the title does not jump. */
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar {count} leads?</AlertDialogTitle>
          <AlertDialogDescription>
            Eles saem das filas de trabalho e vão para Descartados. Dá para desfazer logo em
            seguida.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Manter</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Descartar {count}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
