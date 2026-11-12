import { Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { SearchFormFields } from "@/components/searches/search-form-fields";
import { SearchSizePicker } from "@/components/searches/search-size-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNewSearch } from "@/hooks/use-new-search";

export function NewSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SearchIcon aria-hidden strokeWidth={2} className="size-[18px] shrink-0 text-blue" />
            Nova busca
          </DialogTitle>
          <DialogDescription>
            Uma busca no Google Maps por nicho e cidade. As empresas encontradas são avaliadas pela
            IA como as da busca diária.
          </DialogDescription>
        </DialogHeader>
        {open ? <NewSearchForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** The dialog's form: the same fields, sizes and notices as the "Nova busca" card in Buscas. */
function NewSearchForm({ onDone }: { onDone: () => void }) {
  const newSearch = useNewSearch({ onCreated: onDone });
  const { offerConfigured, statusLoading, blocker, pending, submit } = newSearch;

  return (
    <form className="@container grid gap-5" noValidate onSubmit={submit}>
      <SearchFormFields newSearch={newSearch} idPrefix="dialog-search" autoFocus />
      <SearchSizePicker newSearch={newSearch} />
      {offerConfigured ? null : (
        <p className="text-sm text-muted-foreground">
          Sua oferta ainda não foi descrita, então a nota e a mensagem saem genéricas.{" "}
          <Link to="/settings" onClick={onDone} className="font-medium text-blue hover:underline">
            Descrever agora
          </Link>
        </p>
      )}
      {blocker ? (
        <p role="alert" className="text-sm font-medium text-red">
          {blocker}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || statusLoading || Boolean(blocker)}>
          <SearchIcon />
          {pending ? "Buscando…" : "Buscar empresas"}
        </Button>
      </DialogFooter>
    </form>
  );
}
