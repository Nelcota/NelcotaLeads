import { CircleAlertIcon, CircleCheckIcon, PlugZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SETTINGS_HAIRLINE } from "./surface";
import { SettingsBlock } from "./settings-block";
import { SettingsLine } from "./settings-line";
import { SummaryBar } from "./summary-card";

type Mail = { configured: boolean; address: string; sentToday: number; limit: number };

/** "Caixa de e-mail": where e-mails leave from, how many went today and "Testar conexão". */
export function MailboxBlock({
  mail,
  testing,
  onTest,
}: {
  mail: Mail | null;
  testing: boolean;
  onTest: () => void;
}) {
  // Only once there is a mailbox: a disabled button would explain itself in a tooltip, which
  // never opens on touch.
  const action = mail?.configured ? (
    <Button variant="outline" size="sm" disabled={testing} onClick={onTest}>
      <PlugZapIcon aria-hidden />
      {testing ? "Testando…" : "Testar conexão"}
    </Button>
  ) : undefined;

  return (
    <SettingsBlock
      id="email"
      title="Caixa de e-mail"
      description="De onde os e-mails saem e onde as respostas chegam."
      action={action}
    >
      {mail === null ? null : mail.configured ? (
        <>
          <SettingsLine
            icon={<CircleCheckIcon aria-hidden className="size-[18px] shrink-0 text-green" />}
            label={mail.address}
            sub="Conectada"
          />
          <div className={cn("grid gap-2 border-t py-3.5", SETTINGS_HAIRLINE)}>
            <div className="flex items-center justify-between gap-3">
              <span>Enviados hoje</span>
              <span className="text-muted-foreground tabular-nums">
                {formatCount(mail.sentToday)} de {formatCount(mail.limit)}
              </span>
            </div>
            <SummaryBar used={mail.sentToday} limit={mail.limit} />
          </div>
        </>
      ) : (
        <SettingsLine
          icon={<CircleAlertIcon aria-hidden className="size-[18px] shrink-0 text-orange" />}
          label="E-mail não conectado"
          sub="Quem administra o sistema conecta a caixa. Quando estiver pronta, aparece aqui e os envios começam sozinhos."
        />
      )}
    </SettingsBlock>
  );
}
