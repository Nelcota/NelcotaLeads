import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, pluralize } from "@/lib/format";
import type { SettingsOverview } from "@/server/settings-overview";
import { SettingsBlock } from "./settings-block";
import { SettingsLine } from "./settings-line";

/** "Descadastrados": the latest leads that asked for no more e-mails. Read-only. */
export function UnsubscribedBlock({
  unsubscribed,
  failed,
}: {
  unsubscribed: SettingsOverview["unsubscribed"] | null;
  failed: boolean;
}) {
  return (
    <SettingsBlock
      id="descadastrados"
      title="Descadastrados"
      description="Quem pediu para não receber e-mails. Ninguém daqui volta para a fila."
    >
      <UnsubscribedList unsubscribed={unsubscribed} failed={failed} />
    </SettingsBlock>
  );
}

function UnsubscribedList({
  unsubscribed,
  failed,
}: {
  unsubscribed: SettingsOverview["unsubscribed"] | null;
  failed: boolean;
}) {
  if (failed) {
    return (
      <p className="text-sm text-red">Não foi possível carregar a lista. Atualize a página.</p>
    );
  }
  if (!unsubscribed) {
    return (
      <div role="status" aria-label="Carregando os descadastrados" className="grid gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (unsubscribed.total === 0) {
    return <p className="text-sm text-muted-foreground">Ninguém pediu para sair até agora.</p>;
  }
  const more = unsubscribed.total - unsubscribed.latest.length;
  return (
    <>
      {unsubscribed.latest.map((row) => (
        <SettingsLine
          key={row.id}
          label={<span className="block truncate">{row.email ?? "Sem e-mail"}</span>}
          sub={row.name}
          value={formatDate(new Date(row.unsubscribedAt))}
        />
      ))}
      {more > 0 ? (
        <p className="border-t border-black/[0.06] pt-3 text-sm text-muted-foreground dark:border-white/[0.06]">
          E mais {pluralize(more, "descadastrado", "descadastrados")}.
        </p>
      ) : null}
    </>
  );
}
