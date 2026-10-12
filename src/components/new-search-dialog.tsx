import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { errorToast } from "@/lib/mutation-toasts";
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
import { providerStatusQuery } from "@/lib/queries";
import { newSearchSchema, type NewSearchInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { createSearch } from "@/server/searches";

const PAGE_SIZE = 20;
const SIZES = [20, 40, 60] as const;

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
          <DialogTitle>Busca manual</DialogTitle>
          <DialogDescription>
            Uma busca avulsa no Google Maps. As empresas são avaliadas e recebem mensagem como as do
            piloto automático.
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status } = useQuery(providerStatusQuery);
  const form = useForm<NewSearchInput>({
    resolver: zodResolver(newSearchSchema),
    defaultValues: { niche: "", city: "", maxResults: 20 },
  });
  const { errors } = form.formState;
  const maxResults = useWatch({ control: form.control, name: "maxResults" });
  const requests = Math.ceil(maxResults / PAGE_SIZE);

  const used = status?.placesUsage.used ?? 0;
  const limit = status?.placesUsage.limit ?? 0;
  const remaining = Math.max(0, limit - used);
  const missingKeys = status
    ? [
        !status.placesConfigured && "GOOGLE_PLACES_API_KEY",
        !status.aiConfigured && "DEEPSEEK_API_KEY",
      ].filter((key): key is string => Boolean(key))
    : [];

  const mutation = useMutation({
    mutationFn: (data: NewSearchInput) => createSearch({ data }),
    onSuccess: async ({ searchId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: providerStatusQuery.queryKey }),
      ]);
      onDone();
      // Straight to the new leads; they show up as the analysis finishes.
      await navigate({ to: "/leads", search: { searchId, view: "all" } });
    },
    onError: errorToast("Não foi possível iniciar a busca"),
  });

  const blocker =
    missingKeys.length > 0
      ? `Falta configurar ${missingKeys.join(" e ")} no .dev.vars ou com wrangler secret put.`
      : remaining === 0
        ? `O limite de ${limit} requisições ao Google por dia foi atingido. Volte amanhã.`
        : requests > remaining
          ? `Restam só ${remaining} ${remaining === 1 ? "requisição" : "requisições"} hoje. Peça menos resultados.`
          : null;

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
    >
      <div className="grid gap-2">
        <div className="grid grid-cols-[1fr_auto_1fr] text-xs font-medium text-muted-foreground">
          <Label htmlFor="niche" className="px-1">
            Nicho
          </Label>
          <span />
          <Label htmlFor="city" className="px-1">
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
          <span className="px-1 text-sm font-light text-tertiary">em</span>
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
            const size = SIZES.find((n) => String(n) === value);
            if (size) form.setValue("maxResults", size);
          }}
        >
          <TabsList className="w-full">
            {SIZES.map((size) => (
              <TabsTrigger key={size} value={String(size)}>
                até {size}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="px-1 text-xs font-light text-muted-foreground tabular-nums">
          {requests} {requests === 1 ? "requisição" : "requisições"} ao Google · restam {remaining}{" "}
          de {limit} hoje
        </p>
      </div>

      {status && !status.offerConfigured ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--orange)_10%,transparent)] px-3.5 py-2.5 text-sm font-light text-muted-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--orange)_22%,transparent)]">
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
        <Button type="submit" disabled={mutation.isPending || Boolean(blocker)}>
          <SearchIcon />
          {mutation.isPending ? "Buscando…" : "Buscar empresas"}
        </Button>
      </DialogFooter>
    </form>
  );
}
