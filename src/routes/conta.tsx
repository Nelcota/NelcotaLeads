import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOutIcon, MailIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { Avatar, GroupedRow, IconTile, PropertyRow, SectionHeader } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { providerStatusQuery } from "@/lib/queries";
import type { SettingsInput } from "@/lib/schemas";
import { useTheme } from "@/lib/theme";
import { getSettings, saveSettings } from "@/server/settings";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/conta")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery),
      context.queryClient.ensureQueryData(providerStatusQuery),
    ]),
  component: AccountPage,
});

type ProfileInput = Pick<SettingsInput, "senderName" | "senderCompany">;

function AccountPage() {
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: status } = useQuery(providerStatusQuery);
  const name = settings.senderName || "Sem nome";
  const mail = status?.mail;

  return (
    <Page title="Conta">
      <div className="mx-auto grid w-full max-w-2xl gap-8">
        <section className="enter flex flex-col items-center gap-3 pt-2 text-center">
          <Avatar name={settings.senderName || "?"} size={72} />
          <div className="grid gap-0.5">
            <p className="text-xl font-medium tracking-[-0.02em]">{name}</p>
            <p className="font-light text-muted-foreground">
              {settings.senderCompany || "Empresa não informada"}
            </p>
          </div>
        </section>

        <ProfileForm defaults={settings} />

        <section className="enter min-w-0">
          <SectionHeader title="Caixa de e-mail" />
          <div className="grouped">
            <GroupedRow
              lead={
                <IconTile icon={MailIcon} tone={mail?.configured ? "green" : "orange"} size={30} />
              }
              title={mail?.configured ? mail.address : "Nenhuma caixa conectada"}
              subtitle={mail?.configured ? "Caixa conectada" : "Configure em Configurações"}
              subtitleTone={mail?.configured ? "green" : "orange"}
              trailing={
                <Button asChild variant="outline" size="sm">
                  <Link to="/settings" hash="email">
                    Gerenciar
                  </Link>
                </Button>
              }
            />
          </div>
        </section>

        {status ? (
          <section className="enter min-w-0">
            <SectionHeader title="Uso de hoje" />
            <div className="grouped">
              <PropertyRow label="E-mails enviados">
                {status.mail.sentToday}{" "}
                <span className="font-light text-muted-foreground">de {status.mail.limit}</span>
              </PropertyRow>
              <PropertyRow label="Buscas no Google">
                {status.placesUsage.used}{" "}
                <span className="font-light text-muted-foreground">
                  de {status.placesUsage.limit}
                </span>
              </PropertyRow>
            </div>
          </section>
        ) : null}

        <AppearanceSection />

        <section className="enter min-w-0">
          <SectionHeader title="Sessão" />
          <div className="grouped">
            <GroupedRow
              lead={<IconTile icon={LogOutIcon} tone="red" size={30} />}
              title="Sair deste navegador"
              subtitle="A senha será pedida no próximo acesso."
              trailing={
                <form method="post" action="/api/logout">
                  <Button type="submit" variant="outline" size="sm">
                    Sair
                  </Button>
                </form>
              }
            />
          </div>
        </section>
      </div>
    </Page>
  );
}

function ProfileForm({ defaults }: { defaults: SettingsInput }) {
  const queryClient = useQueryClient();
  const form = useForm<ProfileInput>({
    defaultValues: { senderName: defaults.senderName, senderCompany: defaults.senderCompany },
  });
  const { isDirty } = form.formState;

  // The profile lives in the shared settings record, so the rest of it is sent back unchanged.
  const mutation = useMutation({
    mutationFn: (data: ProfileInput) => saveSettings({ data: { ...defaults, ...data } }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
      toast.success("Perfil salvo");
    },
    onError: () => toast.error("Não foi possível salvar o perfil"),
  });

  return (
    <form
      className="enter min-w-0"
      noValidate
      onSubmit={(event) => void form.handleSubmit((data) => mutation.mutate(data))(event)}
    >
      <SectionHeader
        title="Perfil"
        hint="Usado na assinatura dos e-mails."
        action={
          isDirty || mutation.isPending ? (
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          ) : null
        }
      />
      <div className="grouped">
        <ProfileField label="Seu nome" id="profile-name">
          <Input
            id="profile-name"
            autoComplete="name"
            maxLength={120}
            defaultValue={defaults.senderName}
            {...form.register("senderName", { setValueAs: (v: string) => v.trim() })}
          />
        </ProfileField>
        <ProfileField label="Sua empresa" id="profile-company">
          <Input
            id="profile-company"
            autoComplete="organization"
            maxLength={120}
            defaultValue={defaults.senderCompany}
            {...form.register("senderCompany", { setValueAs: (v: string) => v.trim() })}
          />
        </ProfileField>
      </div>
    </form>
  );
}

function ProfileField({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="grouped-row flex min-h-[52px] items-center gap-4 px-4 py-2 [--inset:16px]">
      <label htmlFor={id} className="w-28 shrink-0 font-light text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="enter min-w-0">
      <SectionHeader title="Aparência" />
      <div className="grouped">
        <div className="grouped-row flex min-h-[52px] items-center justify-between gap-4 px-4 py-2 [--inset:16px]">
          <span className="font-light text-muted-foreground">Tema</span>
          <Tabs
            value={theme}
            onValueChange={(value) => setTheme(value === "light" ? "light" : "dark")}
          >
            <TabsList>
              <TabsTrigger value="dark">
                <MoonIcon /> Escuro
              </TabsTrigger>
              <TabsTrigger value="light">
                <SunIcon /> Claro
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
