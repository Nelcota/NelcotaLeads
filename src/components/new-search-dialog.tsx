import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { providerStatusQuery } from "@/lib/queries";
import { newSearchSchema, type NewSearchInput } from "@/lib/schemas";
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
      <DialogContent className="sm:max-w-lg">
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
    onError: (error) => toast.error(error.message || "Não foi possível iniciar a busca"),
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
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nicho" htmlFor="niche" hint="Ex.: dentistas" error={errors.niche?.message}>
          <Input id="niche" autoFocus autoComplete="off" {...form.register("niche")} />
        </Field>
        <Field
          label="Cidade"
          htmlFor="city"
          hint="Ex.: Belo Horizonte"
          error={errors.city?.message}
        >
          <Input id="city" autoComplete="off" {...form.register("city")} />
        </Field>
      </div>

      <div className="grid gap-2">
        <Label>Quantas empresas</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          className="w-full"
          value={String(maxResults)}
          onValueChange={(value) => {
            const size = SIZES.find((n) => String(n) === value);
            if (size) form.setValue("maxResults", size);
          }}
        >
          {SIZES.map((size) => (
            <ToggleGroupItem key={size} value={String(size)} className="flex-1">
              até {size}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {requests} {requests === 1 ? "requisição" : "requisições"} ao Google · restam {remaining}{" "}
          de {limit} hoje
        </p>
      </div>

      {status && !status.offerConfigured ? (
        <p className="text-sm text-muted-foreground">
          Sua oferta ainda não foi descrita, então a nota e a mensagem saem genéricas.{" "}
          <Link
            to="/settings"
            onClick={onDone}
            className="text-foreground underline underline-offset-4"
          >
            Descrever agora
          </Link>
        </p>
      ) : null}
      {blocker ? (
        <p role="alert" className="text-sm text-destructive">
          {blocker}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending || Boolean(blocker)}>
          {mutation.isPending ? "Buscando…" : "Buscar empresas"}
        </Button>
      </DialogFooter>
    </form>
  );
}
