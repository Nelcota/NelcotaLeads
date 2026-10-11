import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircleIcon, InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { providerStatusQuery } from "@/lib/queries";
import { MAX_RESULTS_LIMIT, newSearchSchema, type NewSearchInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { createSearch } from "@/server/searches";

export const Route = createFileRoute("/searches/new")({
  loader: ({ context }) => context.queryClient.ensureQueryData(providerStatusQuery),
  component: NewSearchPage,
});

const PAGE_SIZE = 20;

function NewSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status } = useSuspenseQuery(providerStatusQuery);
  const form = useForm<NewSearchInput>({
    resolver: zodResolver(newSearchSchema),
    defaultValues: { niche: "", city: "", maxResults: 20 },
  });
  const { errors } = form.formState;
  const maxResults = useWatch({ control: form.control, name: "maxResults" });
  const requests =
    Number.isFinite(maxResults) && maxResults > 0 ? Math.ceil(maxResults / PAGE_SIZE) : 0;

  const { used, limit } = status.placesUsage;
  const remaining = Math.max(0, limit - used);
  const missingKeys = [
    !status.placesConfigured && "GOOGLE_PLACES_API_KEY",
    !status.aiConfigured && "DEEPSEEK_API_KEY",
  ].filter((key): key is string => Boolean(key));
  const blocked = missingKeys.length > 0 || remaining === 0;

  const mutation = useMutation({
    mutationFn: (data: NewSearchInput) => createSearch({ data }),
    onSuccess: async ({ searchId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: providerStatusQuery.queryKey }),
      ]);
      await navigate({ to: "/searches/$searchId", params: { searchId } });
    },
    onError: (error) => toast.error(error.message || "Não foi possível iniciar a busca"),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nova busca"
        description="Encontre empresas no Google por nicho e cidade. A IA lê o site de cada uma e dá uma nota."
      />

      <div className="mb-6 grid gap-3 empty:hidden">
        {missingKeys.length > 0 ? (
          <Notice tone="error">
            Falta configurar{" "}
            {missingKeys.map((key) => (
              <code key={key}>{key} </code>
            ))}
            no <code>.dev.vars</code> (local) ou com <code>wrangler secret put</code> (produção).
          </Notice>
        ) : null}
        {!status.offerConfigured ? (
          <Notice tone="info">
            Descreva o que você vende em{" "}
            <Link to="/settings" className="font-medium underline underline-offset-4">
              Configurações
            </Link>
            . Sem isso, a nota e a mensagem ficam genéricas.
          </Notice>
        ) : null}
        {remaining === 0 ? (
          <Notice tone="error">
            O limite diário de {limit} requisições ao Google foi atingido. Novas buscas liberam
            amanhã.
          </Notice>
        ) : null}
      </div>

      <Card>
        <CardContent>
          <form
            className="grid gap-6"
            noValidate
            onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                label="Nicho"
                htmlFor="niche"
                hint="Ex.: dentistas"
                error={errors.niche?.message}
              >
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
            <Field
              label="Máximo de resultados"
              htmlFor="maxResults"
              hint={`Entre 1 e ${MAX_RESULTS_LIMIT}. O Google devolve até 20 empresas por requisição.`}
              error={errors.maxResults?.message}
            >
              <Input
                id="maxResults"
                type="number"
                min={1}
                max={MAX_RESULTS_LIMIT}
                className="sm:w-40"
                defaultValue={20}
                {...form.register("maxResults", { valueAsNumber: true })}
              />
            </Field>

            <div className="flex flex-col-reverse gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {requests > 0 ? (
                  <>
                    Usa até{" "}
                    <span className="font-medium text-foreground">
                      {requests} {requests === 1 ? "requisição" : "requisições"}
                    </span>{" "}
                    · restam {remaining} de {limit} hoje
                  </>
                ) : (
                  `Restam ${remaining} de ${limit} requisições hoje`
                )}
              </p>
              <Button
                type="submit"
                size="lg"
                className="px-5"
                disabled={mutation.isPending || blocked || requests > remaining}
              >
                {mutation.isPending ? "Coletando empresas…" : "Buscar leads"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  const Icon = tone === "error" ? AlertCircleIcon : InfoIcon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "bg-muted/40 text-foreground",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
