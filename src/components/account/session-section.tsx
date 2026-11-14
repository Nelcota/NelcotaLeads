import { Button } from "@/components/ui/button";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";

/** "Sessão": sign out of this browser. Signing out everywhere comes in PR B. */
export function SessionSection() {
  return (
    <SettingsSection
      id="sessao"
      title="Sessão"
      description="O e-mail e a senha serão pedidos no próximo acesso."
    >
      <SettingsRow
        label="Este navegador"
        action={
          <form method="post" action="/api/logout">
            <Button type="submit" variant="destructive" size="sm">
              Sair
            </Button>
          </form>
        }
      />
    </SettingsSection>
  );
}
