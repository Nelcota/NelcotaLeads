import { CalendarIcon, MessageCircleIcon, TrendingUpIcon, UsersIcon } from "lucide-react";
import { pluralize } from "@/lib/format";
import { WorkShortcut } from "./work-shortcut";

function attentionDetail(count: number | null): string | null {
  if (count === null) return null;
  if (count === 0) return "Nada esperando";
  return pluralize(count, "conversa", "conversas");
}

function agendaDetail(count: number | null): string | null {
  if (count === null) return null;
  if (count === 0) return "Nada hoje";
  return `${count} hoje`;
}

/**
 * The four work shortcuts under the person, as equal blocks: links to the lists already
 * filtered for them. The account's own actions live in their sections below.
 */
export function WorkShortcuts({
  userId,
  attention,
  myToday,
}: {
  userId: string | null;
  /** Null while unknown: the block shows no count line instead of a wrong "nothing". */
  attention: number | null;
  myToday: number | null;
}) {
  return (
    <nav aria-label="Seu trabalho" className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
      <WorkShortcut
        to="/conversas"
        search={{ filter: "needsYou" }}
        icon={MessageCircleIcon}
        label="Precisam de você"
        detail={attentionDetail(attention)}
        urgent={(attention ?? 0) > 0}
      />
      <WorkShortcut
        to="/leads"
        search={{ mine: true }}
        icon={UsersIcon}
        label="Meus leads"
        detail="Os leads com você"
      />
      <WorkShortcut
        to="/agenda"
        search={userId ? { owner: userId } : {}}
        icon={CalendarIcon}
        label="Minha agenda"
        detail={agendaDetail(myToday)}
      />
      {userId ? (
        <WorkShortcut
          to="/equipe"
          search={{ socio: userId }}
          icon={TrendingUpIcon}
          label="Meu desempenho"
          detail="Seus últimos 30 dias"
        />
      ) : null}
    </nav>
  );
}
