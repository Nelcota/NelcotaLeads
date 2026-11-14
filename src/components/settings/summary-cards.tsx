import { CircleAlertIcon, CircleCheckIcon } from "@/components/icons";
import { formatCount } from "@/lib/format";
import { QUICK_REPLY_LIMITS } from "@/lib/schemas";
import type { SettingsSummary } from "@/hooks/use-settings-summary";
import { OnOffStatus } from "./on-off-status";
import { SummaryBar, SummaryCard, SummaryLine } from "./summary-card";

/** The four area cards of the Resumo tab, each with the live state of its area. */
export function SummaryCards({ summary }: { summary: SettingsSummary }) {
  const { mail, automation, ai, templates } = summary;
  const templatesReady = templates.replies !== null && templates.services !== null;

  return (
    <div className="group/cards grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
      <SummaryCard
        tab="email"
        title="E-mail"
        description="A caixa de onde os e-mails saem."
        cta="Abrir E-mail e envio"
      >
        {mail ? (
          <>
            <SummaryLine
              label={<MailState configured={mail.configured} />}
              value={mail.configured ? mail.address : null}
            />
            <SummaryLine
              label="Enviados hoje"
              value={`${formatCount(mail.sentToday)} de ${formatCount(mail.limit)}`}
            />
            <SummaryBar used={mail.sentToday} limit={mail.limit} />
            {mail.window ? (
              <SummaryLine
                label="Horário de envio"
                value={`${mail.window.start}h às ${mail.window.end}h`}
              />
            ) : null}
          </>
        ) : null}
      </SummaryCard>

      <SummaryCard
        tab="automacao"
        title="Automação"
        description="O que roda sozinho, sem você selecionar."
        cta="Abrir Automação"
      >
        {automation ? (
          <>
            <SummaryLine
              label="IA responde sozinha"
              value={
                <OnOffStatus
                  on={automation.aiAutoReply}
                  label={automation.aiAutoReply ? "Ligada" : "Desligada"}
                />
              }
            />
            <SummaryLine
              label="Disparo automático"
              value={
                <OnOffStatus
                  on={automation.autoDispatch}
                  label={automation.autoDispatch ? "Ligado" : "Desligado"}
                />
              }
            />
            <SummaryLine
              label="Busca diária"
              value={
                <OnOffStatus
                  on={automation.nextSearch !== null}
                  label={
                    automation.nextSearch
                      ? `Próxima ${automation.nextSearch.toLowerCase()}`
                      : "Desligada"
                  }
                />
              }
            />
          </>
        ) : null}
      </SummaryCard>

      <SummaryCard
        tab="ia"
        title="IA e pontuação"
        description="Como a IA dá nota e escreve o primeiro e-mail."
        cta="Abrir IA e pontuação"
      >
        {ai ? (
          <>
            <SummaryLine label="Nota mínima" value={`${ai.minScore} de 100`} />
            <SummaryLine label="Tom da mensagem" value={ai.tone} />
            <SummaryLine label="Critérios de pontuação" value={formatCount(ai.criteria)} />
          </>
        ) : null}
      </SummaryCard>

      <SummaryCard
        tab="modelos"
        title="Modelos e serviços"
        description="Textos prontos e a tabela de preços."
        cta="Abrir Modelos e serviços"
      >
        {templatesReady ? (
          <>
            <SummaryLine
              label="Respostas rápidas"
              value={`${templates.replies} de ${QUICK_REPLY_LIMITS.count}`}
            />
            <SummaryLine label="Serviços na tabela" value={formatCount(templates.services ?? 0)} />
            <SummaryLine label="Adicionais" value={formatCount(templates.addons ?? 0)} />
          </>
        ) : null}
      </SummaryCard>
    </div>
  );
}

function MailState({ configured }: { configured: boolean }) {
  const Icon = configured ? CircleCheckIcon : CircleAlertIcon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className={configured ? "size-4 text-green" : "size-4 text-orange"} />
      {configured ? "Conectada" : "E-mail não conectado"}
    </span>
  );
}
