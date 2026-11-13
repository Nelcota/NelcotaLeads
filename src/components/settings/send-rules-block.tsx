import { formatCount, pluralize } from "@/lib/format";
import { SEND_GAP_MINUTES } from "@/lib/schemas";
import { AI_REPLY_LIMIT } from "@/lib/settings-overview";
import { DEFAULT_FOLLOW_UP_DAYS } from "@/server/lead-status";
import { SettingsBlock } from "./settings-block";
import { SettingsLine } from "./settings-line";

/** "Regras de envio": the fixed rules every e-mail follows, shown so nobody has to guess them. */
export function SendRulesBlock({ dailyLimit }: { dailyLimit: number | null }) {
  return (
    <SettingsBlock
      id="regras"
      title="Regras de envio"
      description="Valem para todos os e-mails. Ainda não dá para mudar por aqui."
    >
      <SettingsLine
        label="Limite por dia"
        value={dailyLimit === null ? "—" : `${formatCount(dailyLimit)} e-mails`}
      />
      <SettingsLine label="Intervalo entre envios" value={`${SEND_GAP_MINUTES} minutos`} />
      <SettingsLine
        label="Follow-up sem resposta"
        value={`1 e-mail, depois de ${pluralize(DEFAULT_FOLLOW_UP_DAYS, "dia", "dias")}`}
      />
      <SettingsLine label="Respostas seguidas da IA" value={`até ${AI_REPLY_LIMIT} por conversa`} />
    </SettingsBlock>
  );
}
