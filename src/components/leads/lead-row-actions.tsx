import {
  ArrowRightCircleIcon,
  CheckIcon,
  MailIcon,
  PhoneIcon,
  Trash2Icon,
} from "@/components/icons";
import { WhatsAppMark } from "@/components/brand-marks";
import { DisabledReason, Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LeadStatus } from "@/db/schema";
import { canDiscardFromList, nextStatus } from "@/lib/lead-row";
import { whatsappLink } from "@/lib/phone";
import { LEAD_STATUS_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type RowActionLead = {
  id: string;
  name: string;
  status: LeadStatus;
  phone: string | null;
  phoneE164: string | null;
  email: string | null;
  unsubscribedAt: Date | null;
};

/** Clicks inside the actions never open the lead (the row's own click). */
function stop(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/**
 * The row's quick actions, always visible: WhatsApp, Ligar, Escrever e-mail and Mudar etapa
 * (only the next stage, plus Descartar). Each shows the number or address it uses.
 */
export function LeadRowActions({
  lead,
  onWriteEmail,
  onMove,
  onDiscard,
  busy,
  className,
}: {
  lead: RowActionLead;
  onWriteEmail: (id: string) => void;
  onMove: (id: string, status: "contacted" | "replied") => void;
  onDiscard: (id: string) => void;
  busy?: boolean;
  className?: string;
}) {
  const next = nextStatus(lead.status);
  const mailReason = !lead.email
    ? "Sem e-mail: use WhatsApp ou Ligar"
    : lead.unsubscribedAt
      ? "Pediu para não receber e-mails"
      : false;
  const phone = lead.phone ?? "";

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- only stops the row click from bubbling
    <div
      className={cn("flex items-center justify-end gap-1 pointer-coarse:gap-3", className)}
      onClick={stop}
    >
      {lead.phoneE164 ? (
        <Hint label={`WhatsApp · ${phone}`}>
          <Button asChild variant="ghost" size="icon-sm" className="text-green hover:text-green">
            <a
              href={whatsappLink(lead.phoneE164)}
              target="_blank"
              rel="noreferrer"
              aria-label={`WhatsApp ${phone}`}
            >
              <WhatsAppMark className="size-[17px]" />
            </a>
          </Button>
        </Hint>
      ) : (
        <DisabledReason reason="Sem telefone">
          <Button variant="ghost" size="icon-sm" disabled aria-label="WhatsApp indisponível">
            <WhatsAppMark className="size-[17px]" />
          </Button>
        </DisabledReason>
      )}

      {lead.phone ? (
        <Hint label={`Ligar · ${phone}`}>
          <Button asChild variant="ghost" size="icon-sm">
            <a href={`tel:${lead.phoneE164 ?? lead.phone}`} aria-label={`Ligar para ${phone}`}>
              <PhoneIcon />
            </a>
          </Button>
        </Hint>
      ) : (
        <DisabledReason reason="Sem telefone">
          <Button variant="ghost" size="icon-sm" disabled aria-label="Ligar indisponível">
            <PhoneIcon />
          </Button>
        </DisabledReason>
      )}

      <DisabledReason reason={mailReason}>
        <Hint label={`Escrever e-mail · ${lead.email ?? ""}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={Boolean(mailReason)}
            aria-label={`Escrever e-mail para ${lead.name}`}
            onClick={() => onWriteEmail(lead.id)}
          >
            <MailIcon />
          </Button>
        </Hint>
      </DisabledReason>

      <DropdownMenu>
        <Hint label="Mudar etapa">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Mudar etapa de ${lead.name}`}
              disabled={busy}
            >
              <ArrowRightCircleIcon />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="min-w-52">
          {next ? (
            <DropdownMenuItem onSelect={() => onMove(lead.id, next)}>
              <CheckIcon />
              Marcar como {LEAD_STATUS_LABELS[next]}
            </DropdownMenuItem>
          ) : null}
          {next ? <DropdownMenuSeparator /> : null}
          {canDiscardFromList(lead.status) ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onDiscard(lead.id)}>
              <Trash2Icon />
              Descartar
            </DropdownMenuItem>
          ) : null}
          {/* A conversation ends with its loss reason (the metrics count it): the panel's form. */}
          {lead.status === "replied" ? (
            <DropdownMenuItem variant="destructive" onSelect={() => onDiscard(lead.id)}>
              <Trash2Icon />
              Encerrar sem negócio…
            </DropdownMenuItem>
          ) : null}
          {lead.status === "closed" ? (
            <DropdownMenuItem disabled>Negócio fechado: reabra pelo painel</DropdownMenuItem>
          ) : null}
          {lead.status === "discarded" ? (
            <DropdownMenuItem disabled>Lead descartado</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
