import { zodResolver } from "@hookform/resolvers/zod";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ClockIcon,
  MailIcon,
  MinusIcon,
  PlugZapIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import {
  DisabledReason,
  FloatingBar,
  IconTile,
  InfoTip,
  toneVar,
  type Tone,
} from "@/components/apple-ui";
import { GLOSSARY } from "@/lib/help";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { Page } from "@/components/app-shell";
import { DiscardChangesDialog, LeaveGuard, useReportDirtyForm } from "@/components/leave-guard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AUTOPILOT_RESULTS,
  autopilotInputSchema,
  QUICK_REPLY_LIMITS,
  quickRepliesInputSchema,
  type QuickRepliesInput,
  settingsInputSchema,
  TONE_LABELS,
  TONES,
  type AutopilotInput,
  type SettingsInput,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { providerStatusQuery, quickRepliesQuery } from "@/lib/queries";
import { getAutopilot, saveAutopilot } from "@/server/dashboard";
import { testMailConnection } from "@/server/mail";
import { getSettings, saveQuickReplies, saveSettings } from "@/server/settings";
import { pageTitle } from "@/lib/page-title";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });
const autopilotQuery = queryOptions({ queryKey: ["autopilot"], queryFn: () => getAutopilot() });

// Same bounds as the criterion schema (src/lib/schemas.ts).
const WEIGHT_RANGE = { min: -100, max: 100 };

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const NOTHING_TO_SAVE = "Nenhuma alteração para salvar";

// Same bound as the autopilot schema (src/lib/schemas.ts).
const MAX_TARGETS = 10;

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: pageTitle("Configurações") }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery),
      context.queryClient.ensureQueryData(autopilotQuery),
      // The e-mail card renders from it; prefetching keeps SSR and hydration in agreement.
      context.queryClient.ensureQueryData(providerStatusQuery),
      // Never fails the page: the section shows its own error.
      context.queryClient.prefetchQuery(quickRepliesQuery),
    ]),
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
    <Page title="Configurações">
      <LeaveGuard>
        <div className="mx-auto grid w-full max-w-[720px] gap-8">
          <div className="flex items-center gap-4 px-1">
            <IconTile icon={SettingsIcon} tone="gray" size={60} className="rounded-[15px]!" />
            <div>
              <p className="text-lg font-medium tracking-[-0.02em]">Como a IA trabalha por você</p>
              <p className="text-sm font-light text-muted-foreground">
                Oferta, critérios de nota, tom das mensagens, caixa de e-mail e o que roda sozinho.
              </p>
            </div>
          </div>
          <MailCard />
          <AutopilotForm />
          <SettingsForm defaults={data} />
          <QuickReplies />
        </div>
      </LeaveGuard>
    </Page>
  );
}

function MailCard() {
  const { data: status } = useQuery(providerStatusQuery);
  const test = useMutation({
    mutationFn: () => testMailConnection(),
    onSuccess: (result) =>
      result.ok ? toast.success(result.message) : toast.error(result.message),
    onError: errorToast("Não foi possível testar a conexão. Confira a sua internet."),
  });
  const mail = status?.mail;
  return (
    <SettingsSection
      id="email"
      title="E-mail"
      description={`A caixa de onde os e-mails saem e onde as respostas chegam. Até ${mail?.limit ?? 30} envios por dia, um a cada 8 minutos.`}
      contentClassName="p-0"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <IconTile icon={MailIcon} tone={mail?.configured ? "green" : "orange"} size={30} />
        <div className="min-w-0 flex-1 text-sm">
          {mail?.configured ? (
            <>
              <p className="truncate font-medium">{mail.address}</p>
              <p className="text-[12.5px] font-medium text-green">
                Conectado · {mail.sentToday} de {mail.limit} enviados hoje
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-orange">Caixa não conectada</p>
              <p className="font-light text-muted-foreground">
                A caixa de e-mail ainda não foi configurada. Fale com quem administra o sistema.
              </p>
            </>
          )}
        </div>
        <DisabledReason reason={!mail?.configured && "Conecte a caixa de e-mail primeiro"}>
          <Button
            variant="outline"
            size="sm"
            disabled={!mail?.configured || test.isPending}
            onClick={() => test.mutate()}
          >
            <PlugZapIcon />
            {test.isPending ? "Testando…" : "Testar conexão"}
          </Button>
        </DisabledReason>
      </div>
    </SettingsSection>
  );
}

function AutopilotForm() {
  const { data: defaults } = useSuspenseQuery(autopilotQuery);
  const queryClient = useQueryClient();
  const form = useForm<AutopilotInput>({
    resolver: zodResolver(autopilotInputSchema),
    defaultValues: defaults,
  });
  const targets = useFieldArray({ control: form.control, name: "targets" });
  const { errors, isDirty } = form.formState;
  useReportDirtyForm("autopilot", isDirty);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Removed at once; "Desfazer" puts it back in the same place.
  const removeTarget = (index: number) => {
    const removed = form.getValues(`targets.${index}`);
    targets.remove(index);
    toast("Nicho removido", {
      description:
        removed.niche || removed.city ? `${removed.niche} em ${removed.city}` : undefined,
      action: {
        label: "Desfazer",
        onClick: () => {
          if (form.getValues("targets").length >= MAX_TARGETS) {
            toast.error(`Máximo de ${MAX_TARGETS} nichos`);
            return;
          }
          targets.insert(index, removed, { shouldFocus: false });
        },
      },
    });
  };

  const mutation = useMutation({
    mutationFn: (data: AutopilotInput) => saveAutopilot({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: ["autopilot"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Piloto automático salvo");
    },
    onError: errorToast("Não foi possível salvar o piloto automático"),
  });

  return (
    <form
      id="piloto"
      className="scroll-mt-20"
      noValidate
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
    >
      <SettingsSection
        footer={
          <>
            {isDirty ? (
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => setConfirmDiscard(true)}
              >
                Descartar
              </Button>
            ) : null}
            <DisabledReason reason={!isDirty && NOTHING_TO_SAVE}>
              <Button type="submit" disabled={!isDirty || mutation.isPending}>
                {mutation.isPending ? "Salvando…" : "Salvar modo automático"}
              </Button>
            </DisabledReason>
          </>
        }
        title="Modo automático"
        info={<InfoTip>{GLOSSARY.autopilot.text}</InfoTip>}
        description="O que a IA faz sozinha: responder e-mails, disparar para leads novos e buscar empresas todo dia, cada dia num bairro diferente da cidade."
        contentClassName="grid gap-0 p-0"
      >
        <div className="grid">
          {(
            [
              {
                name: "aiAutoReply",
                label: "IA responde sozinha",
                hint: "Responde os e-mails até a pessoa demonstrar interesse, pedir preço ou reunião. Aí para e te avisa.",
                icon: SparklesIcon,
                tone: "purple",
              },
              {
                name: "autoDispatch",
                label: "Disparo automático",
                hint: "Leads novos com e-mail entram na fila de envio sem você selecionar, dentro do limite diário.",
                icon: SendIcon,
                tone: "blue",
              },
              {
                name: "enabled",
                label: "Busca diária",
                hint: "Busca os nichos e cidades abaixo todo dia, no horário escolhido.",
                icon: ClockIcon,
                tone: "green",
              },
            ] as const satisfies readonly { tone: Tone; [key: string]: unknown }[]
          ).map((item) => (
            <div
              key={item.name}
              className="grouped-row flex items-center gap-3 px-4 py-3 [--inset:58px]"
            >
              <IconTile icon={item.icon} tone={item.tone} size={30} />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <Label htmlFor={`auto-${item.name}`}>{item.label}</Label>
                <p className="text-[12.5px] font-light text-muted-foreground">{item.hint}</p>
              </div>
              <Controller
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <Switch
                    id={`auto-${item.name}`}
                    checked={field.value}
                    style={{ "--switch-on": toneVar(item.tone) }}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-2 border-t border-border/70 px-4 pt-3.5 pb-4">
          <p className="text-[13px] font-medium text-muted-foreground">O que buscar</p>
          {targets.fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Input
                  aria-label={`Nicho ${index + 1}`}
                  placeholder="Nicho, ex.: dentistas"
                  defaultValue={field.niche}
                  {...form.register(`targets.${index}.niche`)}
                  aria-invalid={Boolean(errors.targets?.[index]?.niche)}
                />
                <span className="text-sm font-light text-tertiary">em</span>
                <Input
                  aria-label={`Cidade ${index + 1}`}
                  placeholder="Cidade, ex.: Belo Horizonte"
                  defaultValue={field.city}
                  {...form.register(`targets.${index}.city`)}
                  aria-invalid={Boolean(errors.targets?.[index]?.city)}
                />
              </div>
              <button
                type="button"
                aria-label={`Remover busca ${index + 1}`}
                className="press grid size-[22px] shrink-0 place-items-center rounded-full bg-red text-white"
                onClick={() => removeTarget(index)}
              >
                <MinusIcon className="size-3" strokeWidth={3} />
              </button>
            </div>
          ))}
          <AddRow
            disabledReason={
              targets.fields.length >= MAX_TARGETS && `Máximo de ${MAX_TARGETS} nichos`
            }
            onClick={() => targets.append({ niche: "", city: "" })}
          >
            Adicionar nicho e cidade
          </AddRow>
        </div>

        <div className="grid gap-6 border-t border-border/70 px-4 pt-3.5 pb-4 sm:grid-cols-2">
          <Field label="Horário" hint="Horário de Brasília.">
            <Controller
              control={form.control}
              name="hour"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                >
                  <SelectTrigger className="w-full" aria-label="Horário da busca">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {hour}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Empresas por nicho, por dia"
            hint="Cada 20 empresas usam 1 requisição do limite diário do Google."
          >
            <Controller
              control={form.control}
              name="results"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => {
                    const results = AUTOPILOT_RESULTS.find((n) => String(n) === value);
                    if (results) field.onChange(results);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Empresas por nicho">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOPILOT_RESULTS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        até {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>
      </SettingsSection>
      <DiscardChangesDialog
        open={confirmDiscard}
        description="O modo automático volta a ser como está salvo."
        onCancel={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          form.reset(defaults);
        }}
      />
    </form>
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
  const minScore = useWatch({ control: form.control, name: "minScore" });
  const { errors, isDirty, isSubmitted } = form.formState;
  useReportDirtyForm("settings", isDirty);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Removed at once; "Desfazer" puts it back in the same place.
  const removeCriterion = (index: number) => {
    const removed = form.getValues(`criteria.${index}`);
    criteria.remove(index);
    toast("Critério removido", {
      description: removed.label || undefined,
      action: {
        label: "Desfazer",
        onClick: () => criteria.insert(index, removed, { shouldFocus: false }),
      },
    });
  };
  const setNumber = (name: "minScore" | `criteria.${number}.weight`, value: number) =>
    form.setValue(name, value, { shouldDirty: true, shouldValidate: isSubmitted });
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
    onError: errorToast("Não foi possível salvar as configurações"),
  });

  // Inputs get explicit defaultValue so the server-rendered HTML is already filled in.
  return (
    <form
      className="grid gap-4 lg:gap-6"
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
      noValidate
    >
      <SettingsSection
        id="oferta"
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
        contentClassName="grid gap-2 px-4 py-3.5"
      >
        <div className="grid grid-cols-[1fr_7.5rem_22px] gap-2 px-1 text-xs font-medium text-tertiary">
          <span>Sinal</span>
          <span className="text-center">Peso</span>
        </div>
        {criteria.fields.map((field, index) => {
          const weight = watchedCriteria?.[index]?.weight ?? field.weight;
          return (
            <div key={field.id} className="grid grid-cols-[1fr_7.5rem_22px] items-center gap-2">
              <Input
                aria-label={`Sinal ${index + 1}`}
                defaultValue={field.label}
                {...form.register(`criteria.${index}.label`)}
                aria-invalid={Boolean(errors.criteria?.[index]?.label)}
              />
              <NumberStepper
                {...form.register(`criteria.${index}.weight`, { valueAsNumber: true })}
                aria-label={`Peso ${index + 1}`}
                current={weight}
                min={WEIGHT_RANGE.min}
                max={WEIGHT_RANGE.max}
                step={5}
                onStep={(value) => setNumber(`criteria.${index}.weight`, value)}
                inputClassName={cn(
                  Number.isFinite(weight) && weight > 0 && "text-green",
                  Number.isFinite(weight) && weight < 0 && "text-red",
                )}
                defaultValue={field.weight}
                aria-invalid={Boolean(errors.criteria?.[index]?.weight)}
              />
              <button
                type="button"
                aria-label={`Remover critério ${index + 1}`}
                className="press relative grid size-[22px] shrink-0 place-items-center rounded-full bg-red text-white after:absolute after:-inset-2.5 after:content-['']"
                onClick={() => removeCriterion(index)}
              >
                <MinusIcon className="size-3" strokeWidth={3} />
              </button>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AddRow onClick={() => criteria.append({ label: "", weight: 10 })}>
            Adicionar critério
          </AddRow>
          <p className="text-xs font-light text-muted-foreground">
            Soma dos pesos positivos:{" "}
            <span
              className={cn(
                "font-medium tabular-nums",
                maxScore === 100 ? "text-green" : "text-orange",
              )}
            >
              {maxScore}
            </span>
            {maxScore < 100 ? " (a nota máxima possível fica abaixo de 100)" : null}
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Mensagem de abordagem"
        description="A IA escreve para todo lead que passar da nota mínima. Você revisa e envia."
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
          label="Descartar leads com nota abaixo de"
          htmlFor="minScore"
          hint="A IA descarta sozinha e não escreve para eles. Use 0 para manter todos."
          error={errors.minScore?.message}
          info={<InfoTip>{GLOSSARY.minScore.text}</InfoTip>}
        >
          <NumberStepper
            {...form.register("minScore", { valueAsNumber: true })}
            id="minScore"
            className="max-w-36"
            current={minScore}
            min={0}
            max={100}
            step={5}
            onStep={(value) => setNumber("minScore", value)}
            defaultValue={defaults.minScore}
            aria-invalid={Boolean(errors.minScore)}
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

      {isDirty || mutation.isPending ? (
        <FloatingBar>
          <span className="text-sm font-light opacity-80">Alterações não salvas</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDiscard(true)}
            disabled={mutation.isPending}
          >
            Descartar
          </Button>
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </FloatingBar>
      ) : null}
      <DiscardChangesDialog
        open={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          form.reset(defaults);
        }}
      />
    </form>
  );
}

const QUICK_REPLIES_DESCRIPTION = `Textos prontos que você insere numa resposta pelo botão Modelos, em Conversas. Até ${QUICK_REPLY_LIMITS.count} modelos de até 1.000 caracteres.`;

function QuickReplies() {
  const { data, isError } = useQuery(quickRepliesQuery);
  if (!data) {
    return (
      <SettingsSection
        id="respostas"
        title="Respostas rápidas"
        description={QUICK_REPLIES_DESCRIPTION}
      >
        {isError ? (
          <p className="text-sm font-light text-red">
            Não foi possível carregar os modelos. Atualize a página.
          </p>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </SettingsSection>
    );
  }
  return (
    <QuickRepliesForm defaults={{ replies: data.map(({ title, body }) => ({ title, body })) }} />
  );
}

function QuickRepliesForm({ defaults }: { defaults: QuickRepliesInput }) {
  const queryClient = useQueryClient();
  const form = useForm<QuickRepliesInput>({
    resolver: zodResolver(quickRepliesInputSchema),
    defaultValues: defaults,
  });
  const replies = useFieldArray({ control: form.control, name: "replies" });
  const { errors, isDirty } = form.formState;
  useReportDirtyForm("quick-replies", isDirty);
  const full = replies.fields.length >= QUICK_REPLY_LIMITS.count;

  const mutation = useMutation({
    mutationFn: (data: QuickRepliesInput) => saveQuickReplies({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: quickRepliesQuery.queryKey });
      toast.success("Respostas rápidas salvas");
    },
    onError: errorToast("Não foi possível salvar as respostas rápidas"),
  });

  return (
    <form
      noValidate
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
    >
      <SettingsSection
        id="respostas"
        title="Respostas rápidas"
        description={QUICK_REPLIES_DESCRIPTION}
        contentClassName="grid gap-0 p-0"
        footer={
          <DisabledReason reason={!isDirty && NOTHING_TO_SAVE}>
            <Button type="submit" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar respostas rápidas"}
            </Button>
          </DisabledReason>
        }
      >
        {replies.fields.length === 0 ? (
          <p className="px-4 pt-3.5 text-sm font-light text-muted-foreground">
            Nenhum modelo ainda. Crie um para responder mais rápido.
          </p>
        ) : null}
        {replies.fields.map((field, index) => {
          const error = errors.replies?.[index];
          return (
            <div key={field.id} className="grouped-row grid gap-2 px-4 py-3 [--inset:16px]">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Nome do modelo ${index + 1}`}
                  placeholder="Nome, ex.: Agendar uma ligação"
                  maxLength={QUICK_REPLY_LIMITS.title}
                  defaultValue={field.title}
                  {...form.register(`replies.${index}.title`)}
                  aria-invalid={Boolean(error?.title)}
                />
                <button
                  type="button"
                  aria-label={`Remover modelo ${index + 1}`}
                  className="press relative grid size-[22px] shrink-0 place-items-center rounded-full bg-red text-white after:absolute after:-inset-2.5 after:content-['']"
                  onClick={() => replies.remove(index)}
                >
                  <MinusIcon className="size-3" strokeWidth={3} />
                </button>
              </div>
              <Textarea
                aria-label={`Texto do modelo ${index + 1}`}
                placeholder="O texto que entra na resposta."
                rows={3}
                maxLength={QUICK_REPLY_LIMITS.body}
                defaultValue={field.body}
                {...form.register(`replies.${index}.body`)}
                aria-invalid={Boolean(error?.body)}
              />
              {error?.title?.message || error?.body?.message ? (
                <p className="text-xs text-destructive">
                  {error.title?.message ?? error.body?.message}
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-3 px-4 pt-2.5 pb-3.5">
          <AddRow
            disabledReason={full && `Máximo de ${QUICK_REPLY_LIMITS.count} modelos`}
            onClick={() => replies.append({ title: "", body: "" })}
          >
            Adicionar modelo
          </AddRow>
          {full ? (
            <p className="text-xs font-light text-muted-foreground">
              Chegou ao limite de {QUICK_REPLY_LIMITS.count} modelos.
            </p>
          ) : null}
        </div>
      </SettingsSection>
    </form>
  );
}

/** Settings-style section: title above, grouped list, the description as a footnote below. */
function SettingsSection({
  id,
  title,
  info,
  description,
  contentClassName,
  footer,
  children,
}: {
  id?: string;
  title: string;
  info?: ReactNode;
  description: string;
  contentClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="enter scroll-mt-20">
      <h2 className="flex items-center gap-1.5 px-1.5 pb-2 text-lg font-medium tracking-[-0.015em]">
        {title}
        {info}
      </h2>
      <div className="grouped">
        <div className={cn("px-4 py-4", contentClassName)}>{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border/70 px-4 py-3">{footer}</div>
        ) : null}
      </div>
      <p className="px-4 pt-2 text-xs leading-relaxed font-light text-tertiary">{description}</p>
    </section>
  );
}

/** "+ Add …" row: green round plus and a blue label, like the Settings app. */
function AddRow({
  children,
  disabledReason,
  onClick,
}: {
  children: ReactNode;
  /** Disables the row and says why in a tooltip. */
  disabledReason?: string | false;
  onClick: () => void;
}) {
  return (
    <DisabledReason reason={disabledReason}>
      <button
        type="button"
        disabled={Boolean(disabledReason)}
        onClick={onClick}
        className="press inline-flex items-center gap-2.5 py-1 text-sm font-medium text-blue disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="grid size-[22px] place-items-center rounded-full bg-green text-primary-foreground">
          <PlusIcon className="size-3" strokeWidth={3} />
        </span>
        {children}
      </button>
    </DisabledReason>
  );
}
