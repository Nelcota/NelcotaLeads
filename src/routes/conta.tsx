import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOutIcon, MailIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { Page } from "@/components/app-shell";
import { LeaveGuard, useReportDirtyForm } from "@/components/leave-guard";
import { Avatar, GroupedRow, IconTile, PropertyRow, SectionHeader } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { AvatarEditor } from "@/components/avatar-editor";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemStatusSection } from "@/components/system-status";
import { companiesLeftLabel } from "@/lib/google-quota";
import { accountQuery, providerStatusQuery, systemStatusQuery } from "@/lib/queries";
import type { SettingsInput } from "@/lib/schemas";
import { useTheme } from "@/lib/theme";
import { getSettings, saveSettings } from "@/server/settings";
import { saveAvatar } from "@/server/account";
import { pageTitle } from "@/lib/page-title";

const settingsQuery = queryOptions({ queryKey: ["settings"], queryFn: () => getSettings() });

export const Route = createFileRoute("/conta")({
  head: () => ({ meta: [{ title: pageTitle("Conta") }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery),
      context.queryClient.ensureQueryData(providerStatusQuery),
      context.queryClient.ensureQueryData(accountQuery),
      context.queryClient.ensureQueryData(systemStatusQuery),
    ]),
  component: AccountPage,
});

type ProfileInput = Pick<SettingsInput, "senderName" | "senderCompany">;

function AccountPage() {
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const { data: status } = useQuery(providerStatusQuery);
  const { data: account } = useQuery(accountQuery);
  const name = account?.name || settings.senderName || "Sem nome";
  const mail = status?.mail;

  return (
    <Page title="Conta">
      <LeaveGuard>
        <div className="mx-auto grid w-full max-w-2xl gap-8">
          <section className="enter flex flex-col items-center gap-3 pt-2 text-center">
            <AvatarPicker name={name === "Sem nome" ? "?" : name} src={account?.avatar} />
            <div className="grid gap-0.5">
              <p className="text-lg font-semibold tracking-[-0.02em]">{name}</p>
              <p className="text-muted-foreground">
                {account?.email ?? (settings.senderCompany || "Empresa não informada")}
              </p>
            </div>
          </section>

          <ProfileForm defaults={settings} />

          <section className="enter min-w-0">
            <SectionHeader title="Caixa de e-mail" />
            <div className="grouped">
              <GroupedRow
                lead={
                  <IconTile
                    icon={MailIcon}
                    tone={mail?.configured ? "green" : "orange"}
                    size={30}
                  />
                }
                title={mail?.configured ? mail.address : "Nenhuma caixa conectada"}
                subtitle={
                  mail?.configured ? "Caixa conectada" : "Aguardando quem administra o sistema"
                }
                subtitleTone={mail?.configured ? "green" : "orange"}
                trailing={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/settings" hash="email">
                      {mail?.configured ? "Gerenciar" : "Detalhes"}
                    </Link>
                  </Button>
                }
              />
            </div>
          </section>

          <SystemStatusSection />

          {status ? (
            <section className="enter min-w-0">
              <SectionHeader title="Uso de hoje" />
              <div className="grouped">
                <PropertyRow label="E-mails enviados">
                  {status.mail.sentToday}{" "}
                  <span className="text-muted-foreground">de {status.mail.limit}</span>
                </PropertyRow>
                <PropertyRow label="Buscas no Google">
                  {companiesLeftLabel(status.placesUsage)}
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
                subtitle="O e-mail e a senha serão pedidos no próximo acesso."
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
      </LeaveGuard>
    </Page>
  );
}

/** The big avatar on top. Like macOS, "Editar" shows on hover and opens the photo editor. */
function AvatarPicker({ name, src }: { name: string; src?: string | null }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [session, setSession] = useState(0);
  const mutation = useMutation({
    mutationFn: (avatar: string | null) => saveAvatar({ data: { avatar } }),
    onSuccess: async (_result, avatar) => {
      await queryClient.invalidateQueries({ queryKey: accountQuery.queryKey });
      setEditing(false);
      toast.success(avatar ? "Foto atualizada" : "Foto removida");
    },
    onError: errorToast("Não foi possível salvar a foto"),
  });

  return (
    <>
      <button
        type="button"
        aria-label={src ? "Editar foto do perfil" : "Adicionar foto do perfil"}
        onClick={() => {
          setSession((n) => n + 1);
          setEditing(true);
        }}
        className="press group relative overflow-hidden rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar name={name} src={src} size={72} />
        <span className="absolute inset-x-0 bottom-0 grid h-6 place-items-center bg-black/55 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
          {src ? "Editar" : "Adicionar"}
        </span>
      </button>
      <AvatarEditor
        key={session}
        open={editing}
        onOpenChange={setEditing}
        name={name}
        current={src}
        saving={mutation.isPending}
        onSave={(avatar) => mutation.mutate(avatar)}
      />
    </>
  );
}

function ProfileForm({ defaults }: { defaults: SettingsInput }) {
  const queryClient = useQueryClient();
  const form = useForm<ProfileInput>({
    defaultValues: { senderName: defaults.senderName, senderCompany: defaults.senderCompany },
  });
  const { isDirty } = form.formState;
  useReportDirtyForm("profile", isDirty);

  // The profile lives in the shared settings record, so the rest of it is sent back unchanged.
  const mutation = useMutation({
    mutationFn: (data: ProfileInput) => saveSettings({ data: { ...defaults, ...data } }),
    onSuccess: async (_result, data) => {
      form.reset(data);
      await queryClient.invalidateQueries({ queryKey: settingsQuery.queryKey });
      toast.success("Perfil salvo");
    },
    onError: errorToast("Não foi possível salvar o perfil"),
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
      <label htmlFor={id} className="w-28 shrink-0 text-muted-foreground">
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
          <span className="text-muted-foreground">Tema</span>
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
