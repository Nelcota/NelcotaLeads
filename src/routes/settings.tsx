import { zodResolver } from "@hookform/resolvers/zod";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  AUTOPILOT_RESULTS,
  autopilotInputSchema,
  settingsInputSchema,
  TONE_LABELS,
  TONES,
  type AutopilotInput,
  type SettingsInput,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { providerStatusQuery } from "@/lib/queries";
import { getAutopilot, saveAutopilot } from "@/server/dashboard";
import { testMailConnection } from "@/server/mail";
import { getSettings, saveSettings } from "@/server/settings";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });
const autopilotQuery = queryOptions({ queryKey: ["autopilot"], queryFn: () => getAutopilot() });

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export const Route = createFileRoute("/settings")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery),
      context.queryClient.ensureQueryData(autopilotQuery),
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
      <div className="mx-auto grid w-full max-w-3xl gap-4 lg:gap-6">
        <MailCard />
        <AutopilotForm />
        <SettingsForm defaults={data} />
      </div>
    </Page>
  );
}

function MailCard() {
  const { data: status } = useQuery(providerStatusQuery);
  const test = useMutation({
    mutationFn: () => testMailConnection(),
    onSuccess: (result) =>
      result.ok ? toast.success(result.message) : toast.error(result.message),
  });
  const mail = status?.mail;
  return (
    <Card id="email" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>E-mail</CardTitle>
        <CardDescription>
          A caixa de onde os e-mails saem e onde as respostas chegam. Até {mail?.limit ?? 30} envios
          por dia, um a cada 8 minutos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {mail?.configured ? (
          <p>
            Conectado como <span className="font-medium">{mail.address}</span>. Hoje:{" "}
            {mail.sentToday} de {mail.limit} enviados.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Coloque <code>MAIL_ADDRESS</code> e <code>MAIL_PASSWORD</code> da sua caixa da Hostinger
            no arquivo <code>.dev.vars</code> e reinicie o app. Em produção, use{" "}
            <code>wrangler secret put</code>.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button
          variant="outline"
          disabled={!mail?.configured || test.isPending}
          onClick={() => test.mutate()}
        >
          {test.isPending ? "Testando…" : "Testar conexão"}
        </Button>
      </CardFooter>
    </Card>
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

  const mutation = useMutation({
    mutationFn: (data: AutopilotInput) => saveAutopilot({ data }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: ["autopilot"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Piloto automático salvo");
    },
    onError: () => toast.error("Não foi possível salvar o piloto automático"),
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
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar modo automático"}
          </Button>
        }
        title="Modo automático"
        description="O que a IA faz sozinha: responder e-mails, disparar para leads novos e buscar empresas todo dia, cada dia num bairro diferente da cidade."
        contentClassName="grid gap-6"
      >
        <div className="grid gap-4">
          {(
            [
              {
                name: "aiAutoReply",
                label: "IA responde sozinha",
                hint: "Responde os e-mails até a pessoa demonstrar interesse, pedir preço ou reunião. Aí para e te avisa.",
              },
              {
                name: "autoDispatch",
                label: "Disparo automático",
                hint: "Leads novos com e-mail entram na fila de envio sem você selecionar, dentro do limite diário.",
              },
              {
                name: "enabled",
                label: "Busca diária",
                hint: "Busca os nichos e cidades abaixo todo dia, no horário escolhido.",
              },
            ] as const
          ).map((item) => (
            <div key={item.name} className="flex items-start justify-between gap-4">
              <div className="grid gap-0.5">
                <Label htmlFor={`auto-${item.name}`}>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.hint}</p>
              </div>
              <Controller
                control={form.control}
                name={item.name}
                render={({ field }) => (
                  <Switch
                    id={`auto-${item.name}`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium">O que buscar</p>
          {targets.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_1fr_2rem] items-start gap-2">
              <Input
                aria-label={`Nicho ${index + 1}`}
                placeholder="Nicho, ex.: dentistas"
                defaultValue={field.niche}
                {...form.register(`targets.${index}.niche`)}
                aria-invalid={Boolean(errors.targets?.[index]?.niche)}
              />
              <Input
                aria-label={`Cidade ${index + 1}`}
                placeholder="Cidade, ex.: Belo Horizonte"
                defaultValue={field.city}
                {...form.register(`targets.${index}.city`)}
                aria-invalid={Boolean(errors.targets?.[index]?.city)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover busca ${index + 1}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => targets.remove(index)}
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
              disabled={targets.fields.length >= 10}
              onClick={() => targets.append({ niche: "", city: "" })}
            >
              <PlusIcon /> Adicionar nicho e cidade
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
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
      className="grid gap-4 lg:gap-6"
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
        >
          <Input
            id="minScore"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            defaultValue={defaults.minScore}
            {...form.register("minScore", { valueAsNumber: true })}
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
        <div className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t bg-background/95 backdrop-blur lg:-mx-6 lg:-mb-6">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
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
      ) : null}
    </form>
  );
}

function SettingsSection({
  title,
  description,
  contentClassName,
  footer,
  children,
}: {
  title: string;
  description: string;
  contentClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
      {footer ? <CardFooter className="justify-end border-t">{footer}</CardFooter> : null}
    </Card>
  );
}
