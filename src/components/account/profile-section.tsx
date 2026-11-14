import { Avatar } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";

/** "Perfil": the photo, the name and the sign-in e-mail. Name and password edits come in PR B. */
export function ProfileSection({
  name,
  email,
  avatar,
  onChangePhoto,
}: {
  name: string;
  email: string | null;
  avatar: string | null;
  onChangePhoto: () => void;
}) {
  return (
    <SettingsSection
      id="perfil"
      title="Perfil"
      description="Como você aparece para a equipe e entra no Nelcota Leads."
    >
      <SettingsRow
        label="Foto"
        action={
          <Button variant="ghost" size="sm" onClick={onChangePhoto}>
            {avatar ? "Alterar" : "Adicionar"}
          </Button>
        }
      >
        <Avatar name={name} src={avatar} size={32} />
      </SettingsRow>
      <SettingsRow label="Nome">{name}</SettingsRow>
      <SettingsRow label="E-mail de acesso">
        {email ?? <span className="text-muted-foreground">Não informado</span>}
      </SettingsRow>
    </SettingsSection>
  );
}
