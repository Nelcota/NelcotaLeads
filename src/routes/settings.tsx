import { zodResolver } from "@hookform/resolvers/zod";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { settingsInputSchema, TONE_LABELS, TONES, type SettingsInput } from "@/lib/schemas";
import { getSettings, saveSettings } from "@/server/settings";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  return (
    <>
      <PageHeader
        title="O que eu vendo"
        description="Essas informações orientam a IA na análise, na nota e na mensagem de abordagem."
      />
      <SettingsForm defaults={data} />
    </>
  );
}

function SettingsForm({ defaults }: { defaults: SettingsInput }) {
  const queryClient = useQueryClient();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsInputSchema),
    defaultValues: defaults,
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const { errors, isDirty } = form.formState;

  const mutation = useMutation({
    mutationFn: (data: SettingsInput) => saveSettings({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
      toast.success("Configurações salvas");
    },
    onError: () => toast.error("Não foi possível salvar as configurações"),
  });

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
      noValidate
    >
      <Card>
        <CardHeader>
          <CardTitle>Oferta e cliente ideal</CardTitle>
          <CardDescription className="font-light">Texto livre, em português.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field
            label="Descrição da oferta"
            htmlFor="offer"
            hint="Ex.: criação de sites e automação para clínicas"
            error={errors.offer?.message}
          >
            <Textarea id="offer" rows={3} {...form.register("offer")} />
          </Field>
          <Field
            label="Perfil de cliente ideal"
            htmlFor="idealCustomer"
            error={errors.idealCustomer?.message}
          >
            <Textarea id="idealCustomer" rows={3} {...form.register("idealCustomer")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Critérios de pontuação</CardTitle>
          <CardDescription className="font-light">
            Sinais e pesos que a IA usa para compor a nota de 0 a 100.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {criteria.fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  aria-label="Sinal"
                  {...form.register(`criteria.${index}.label`)}
                  aria-invalid={Boolean(errors.criteria?.[index]?.label)}
                />
              </div>
              <div className="flex w-28 items-center gap-1.5">
                <span className="text-sm font-light text-muted-foreground">+</span>
                <Input
                  aria-label="Peso"
                  type="number"
                  className="tabular-nums"
                  {...form.register(`criteria.${index}.weight`, { valueAsNumber: true })}
                  aria-invalid={Boolean(errors.criteria?.[index]?.weight)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover critério"
                onClick={() => criteria.remove(index)}
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => criteria.append({ label: "", weight: 10 })}
            >
              <PlusIcon /> Adicionar critério
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abordagem</CardTitle>
          <CardDescription className="font-light">
            Tom e assinatura da mensagem sugerida. O envio é sempre manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Tom da mensagem">
            <Controller
              control={form.control}
              name="tone"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map((tone) => (
                      <SelectItem key={tone} value={tone}>
                        {TONE_LABELS[tone]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Gerar mensagem a partir da nota"
            htmlFor="threshold"
            hint="Leads com nota igual ou acima deste valor recebem mensagem sugerida."
            error={errors.messageScoreThreshold?.message}
          >
            <Input
              id="threshold"
              type="number"
              min={0}
              max={100}
              {...form.register("messageScoreThreshold", { valueAsNumber: true })}
            />
          </Field>
          <Field label="Seu nome" htmlFor="senderName" error={errors.senderName?.message}>
            <Input id="senderName" {...form.register("senderName")} />
          </Field>
          <Field label="Sua empresa" htmlFor="senderCompany" error={errors.senderCompany?.message}>
            <Input id="senderCompany" {...form.register("senderCompany")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || mutation.isPending}>
          {mutation.isPending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
