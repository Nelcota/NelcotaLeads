import { zodResolver } from "@hookform/resolvers/zod";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { getSettings, saveSettings } from "@/server/settings";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

const TONE_HINTS: Record<SettingsInput["tone"], string> = {
  formal: "Cordial e respeitoso, sem intimidade.",
  consultivo: "Mostra que entendeu o negócio e oferece ajuda.",
  direto: "Curto e objetivo, vai direto ao ponto.",
};

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="O que eu vendo" />
      <SettingsForm defaults={data} />
    </div>
  );
}

function SettingsForm({ defaults }: { defaults: SettingsInput }) {
  const queryClient = useQueryClient();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsInputSchema),
    defaultValues: defaults,
  });
  const criteria = useFieldArray({ control: form.control, name: "criteria" });
  const watchedCriteria = useWatch({ control: form.control, name: "criteria" });
  const tone = useWatch({ control: form.control, name: "tone" });
  const { errors, isDirty } = form.formState;
  const maxScore = (watchedCriteria ?? []).reduce(
    (sum, c) => sum + (Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0),
    0,
  );

  const mutation = useMutation({
    mutationFn: (data: SettingsInput) => saveSettings({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: ["provider-status"] });
      toast.success("Configurações salvas");
    },
    onError: () => toast.error("Não foi possível salvar as configurações"),
  });

  // Inputs get explicit defaultValue so the server-rendered HTML is already filled in.
  return (
    <form
      className="grid pb-24"
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
      noValidate
    >
      <SettingsSection
        title="Oferta e cliente ideal"
        description="Quanto mais específico, melhor a nota e a mensagem."
        contentClassName="grid gap-6"
      >
        <Field
          label="O que você oferece"
          htmlFor="offer"
          hint="Ex.: criação de sites e automação de agendamento para clínicas odontológicas"
          error={errors.offer?.message}
        >
          <Textarea id="offer" rows={3} defaultValue={defaults.offer} {...form.register("offer")} />
        </Field>
        <Field
          label="Para quem"
          htmlFor="idealCustomer"
          hint="Ex.: clínicas pequenas, sem site ou com site antigo, que dependem de indicação"
          error={errors.idealCustomer?.message}
        >
          <Textarea
            id="idealCustomer"
            rows={3}
            defaultValue={defaults.idealCustomer}
            {...form.register("idealCustomer")}
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        title="Critérios de pontuação"
        description="A nota é a soma dos pesos dos critérios que se aplicam a cada empresa, limitada a 100."
        contentClassName="grid gap-2"
      >
        <div className="grid grid-cols-[1fr_6.5rem_2rem] gap-2 text-xs text-muted-foreground">
          <span>Sinal</span>
          <span>Peso</span>
        </div>
        {criteria.fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_6.5rem_2rem] items-start gap-2">
            <Input
              aria-label={`Sinal ${index + 1}`}
              defaultValue={field.label}
              {...form.register(`criteria.${index}.label`)}
              aria-invalid={Boolean(errors.criteria?.[index]?.label)}
            />
            <Input
              aria-label={`Peso ${index + 1}`}
              type="number"
              inputMode="numeric"
              className="tabular-nums"
              defaultValue={field.weight}
              {...form.register(`criteria.${index}.weight`, { valueAsNumber: true })}
              aria-invalid={Boolean(errors.criteria?.[index]?.weight)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover critério ${index + 1}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => criteria.remove(index)}
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => criteria.append({ label: "", weight: 10 })}
          >
            <PlusIcon /> Adicionar critério
          </Button>
          <p className="text-xs text-muted-foreground">
            Soma dos pesos positivos:{" "}
            <span className={cn("font-medium tabular-nums", maxScore !== 100 && "text-foreground")}>
              {maxScore}
            </span>
            {maxScore < 100 ? " (a nota máxima possível fica abaixo de 100)" : null}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Mensagem de abordagem"
        description="Gerada automaticamente para leads com nota alta. Você revisa e envia."
        contentClassName="grid gap-6 sm:grid-cols-2"
      >
        <Field label="Tom" hint={TONE_HINTS[tone]}>
          <Controller
            control={form.control}
            name="tone"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full" aria-label="Tom da mensagem">
                  <SelectValue>{TONE_LABELS[field.value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {TONE_LABELS[value]}
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
          hint="Abaixo disso, você ainda pode gerar na página do lead."
          error={errors.messageScoreThreshold?.message}
        >
          <Input
            id="threshold"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            defaultValue={defaults.messageScoreThreshold}
            {...form.register("messageScoreThreshold", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Seu nome" htmlFor="senderName" error={errors.senderName?.message}>
          <Input
            id="senderName"
            autoComplete="name"
            defaultValue={defaults.senderName}
            {...form.register("senderName")}
          />
        </Field>
        <Field label="Sua empresa" htmlFor="senderCompany" error={errors.senderCompany?.message}>
          <Input
            id="senderCompany"
            autoComplete="organization"
            defaultValue={defaults.senderCompany}
            {...form.register("senderCompany")}
          />
        </Field>
      </SettingsSection>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur transition-transform duration-200",
          isDirty || mutation.isPending ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:pl-[calc(248px+3rem)]">
          <p className="text-sm text-muted-foreground">Alterações não salvas</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => form.reset(defaults)}
              disabled={mutation.isPending}
            >
              Descartar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function SettingsSection({
  title,
  description,
  contentClassName,
  children,
}: {
  title: string;
  description: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t py-10 first:border-t-0 first:pt-2 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
