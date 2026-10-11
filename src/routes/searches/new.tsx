import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { providerStatusQuery } from "@/lib/queries";
import { MAX_RESULTS_LIMIT, newSearchSchema, type NewSearchInput } from "@/lib/schemas";
import { createSearch } from "@/server/searches";

export const Route = createFileRoute("/searches/new")({ component: NewSearchPage });

function NewSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: providers } = useQuery(providerStatusQuery);
  const form = useForm<NewSearchInput>({
    resolver: zodResolver(newSearchSchema),
    defaultValues: { niche: "", city: "", maxResults: 20 },
  });
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: (data: NewSearchInput) => createSearch({ data }),
    onSuccess: async ({ searchId }) => {
      await queryClient.invalidateQueries({ queryKey: ["searches"] });
      await navigate({ to: "/searches/$searchId", params: { searchId } });
    },
    onError: () => toast.error("Não foi possível iniciar a busca"),
  });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nova busca"
        description="O sistema coleta empresas no Google e a IA qualifica cada uma."
      />
      {providers?.places === "mock" ? (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-3 text-sm font-light text-muted-foreground">
          Sem <code>GOOGLE_PLACES_API_KEY</code>: usando dados simulados.
        </p>
      ) : null}
      <Card>
        <CardContent>
          <form
            className="grid gap-5"
            noValidate
            onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
          >
            <Field
              label="Nicho"
              htmlFor="niche"
              hint="Ex.: dentistas"
              error={errors.niche?.message}
            >
              <Input id="niche" autoFocus {...form.register("niche")} />
            </Field>
            <Field
              label="Cidade"
              htmlFor="city"
              hint="Ex.: Belo Horizonte"
              error={errors.city?.message}
            >
              <Input id="city" {...form.register("city")} />
            </Field>
            <Field
              label="Máximo de resultados"
              htmlFor="maxResults"
              hint={`Até ${MAX_RESULTS_LIMIT}. Cada página de 20 resultados é uma requisição paga ao Google.`}
              error={errors.maxResults?.message}
            >
              <Input
                id="maxResults"
                type="number"
                min={1}
                max={MAX_RESULTS_LIMIT}
                {...form.register("maxResults", { valueAsNumber: true })}
              />
            </Field>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Coletando empresas…" : "Buscar leads"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
