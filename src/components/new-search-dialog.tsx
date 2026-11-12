import { Link } from "@tanstack/react-router";
import { MapPinIcon, SearchIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEARCH_SIZES, useNewSearch } from "@/hooks/use-new-search";
import { searchCostLabel } from "@/lib/google-quota";
import { cn } from "@/lib/utils";

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

// The two fields read as one sentence: "[nicho] em [cidade]".
const PHRASE_INPUT =
  "h-11 w-full min-w-0 bg-transparent px-3.5 text-base outline-none placeholder:text-tertiary aria-invalid:text-red";

function NewSearchForm({ onDone }: { onDone: () => void }) {
  const {
    form,
    errors,
    maxResults,
    usage,
    offerConfigured,
    statusLoading,
    blocker,
    pending,
    submit,
  } = useNewSearch({ onCreated: onDone });

  return (
    <form className="grid gap-5" noValidate onSubmit={submit}>
      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_auto_1fr] text-xs font-medium text-muted-foreground">
          <Label htmlFor="niche" className="flex items-center gap-1.5 px-1">
            <TagIcon aria-hidden strokeWidth={2} className="size-3.5 shrink-0" />
            Nicho
          </Label>
          <span />
          <Label htmlFor="city" className="flex items-center gap-1.5 px-1">
            <MapPinIcon aria-hidden strokeWidth={2} className="size-3.5 shrink-0" />
            Cidade
          </Label>
        </div>
        <div
          className={cn(
            "grid grid-cols-[1fr_auto_1fr] items-center rounded-full bg-black/[0.03] shadow-[inset_0_0_0_1px_var(--input)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--ring)] focus-within:ring-3 focus-within:ring-ring/30 dark:bg-black/25",
            (errors.niche || errors.city) && "shadow-[inset_0_0_0_1px_var(--red)]",
          )}
        >
          <input
            id="niche"
            autoFocus
            autoComplete="off"
            placeholder="Ex.: dentistas"
            aria-invalid={Boolean(errors.niche)}
            className={PHRASE_INPUT}
            {...form.register("niche")}
          />
          <span className="px-1 text-sm text-tertiary">em</span>
          <input
            id="city"
            autoComplete="off"
            placeholder="Ex.: Belo Horizonte"
            aria-invalid={Boolean(errors.city)}
            className={PHRASE_INPUT}
            {...form.register("city")}
          />
        </div>
        {errors.niche || errors.city ? (
          <p className="px-1 text-xs text-red">{errors.niche?.message ?? errors.city?.message}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label className="px-1 text-xs font-medium text-muted-foreground">Quantas empresas</Label>
        <Tabs
          value={String(maxResults)}
          onValueChange={(value) => {
            const size = SEARCH_SIZES.find((n) => String(n) === value);
            if (size) form.setValue("maxResults", size);
          }}
        >
          <TabsList className="w-full">
            {SEARCH_SIZES.map((size) => (
              <TabsTrigger key={size} value={String(size)}>
                até {size}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {usage ? (
          <p className="px-1 text-xs text-muted-foreground tabular-nums">
            {searchCostLabel(maxResults, usage)}
          </p>
        ) : null}
        {statusLoading ? (
          <p className="px-1 text-xs text-muted-foreground">Carregando a cota…</p>
        ) : null}
      </div>

      {!offerConfigured ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--orange)_10%,transparent)] px-3.5 py-2.5 text-sm text-muted-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--orange)_22%,transparent)]">
          <span className="font-medium text-orange">
            Sua oferta ainda não foi descrita, então a nota e a mensagem saem genéricas.
          </span>{" "}
          <Link to="/settings" onClick={onDone} className="font-medium text-blue hover:underline">
            Descrever agora
          </Link>
        </p>
      ) : null}
      {blocker ? (
        <p
          role="alert"
          className="rounded-xl bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-3.5 py-2.5 text-sm font-medium text-red shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--red)_22%,transparent)]"
        >
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
