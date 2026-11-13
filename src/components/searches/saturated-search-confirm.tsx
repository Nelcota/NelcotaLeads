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
import type { Search } from "@/db/schema";
import { knownShareText } from "@/lib/previous-search";
import { searchLabel } from "@/lib/searches";

/**
 * "Buscar mesmo assim?" before repeating a place that came back mostly with companies already
 * stored. Not searching is the default answer; the quota is only spent on a clear yes.
 */
export function SaturatedSearchConfirm({
  previous,
  open,
  onCancel,
  onConfirm,
}: {
  previous: Search;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Este lugar já rendeu quase tudo</AlertDialogTitle>
          <AlertDialogDescription>
            Na última busca de {searchLabel(previous)}, {knownShareText(previous)} empresas já
            existiam. Buscar de novo gasta a cota de hoje e deve trazer poucas novas. Um bairro ou
            uma cidade vizinha costuma render mais.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Não buscar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Buscar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
