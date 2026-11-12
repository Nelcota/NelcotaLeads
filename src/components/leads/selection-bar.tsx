import { ArrowRightCircleIcon, DownloadIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef } from "react";
import { DisabledReason, FloatingBar, Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LeadStatus } from "@/db/schema";
import { dispatchBlocker } from "@/lib/dispatch-review";
import { DISPATCH_LIMIT, LEAD_STATUS_LABELS } from "@/lib/schemas";

/** Same bound as the CSV route's selection export. */
const EXPORT_SELECTION_LIMIT = 1000;

/** "Mudar etapa" for a selection: never Fechado (needs value and service) nor Descartado. */
export const BULK_STATUSES = [
  "new",
  "contacted",
  "replied",
] as const satisfies readonly LeadStatus[];

/**
 * The bar that floats at the bottom while leads are selected: Disparar (opens the review),
 * Mudar etapa, Descartar, Exportar and Limpar.
 */
export function SelectionBar({
  ids,
  sendable,
  busy,
  onDispatch,
  onMove,
  onDiscard,
  onClear,
}: {
  ids: string[];
  /** Selected leads that can get a first e-mail (new, with an address). */
  sendable: number;
  busy: boolean;
  onDispatch: () => void;
  onMove: (status: (typeof BULK_STATUSES)[number]) => void;
  onDiscard: () => void;
  onClear: () => void;
}) {
  const exportForm = useRef<HTMLFormElement>(null);
  const left = ids.length - sendable;
  const dispatchReason = dispatchBlocker({
    selected: ids.length,
    sendable,
    limit: DISPATCH_LIMIT,
  });

  return (
    <FloatingBar role="region" aria-label="Ações da seleção" className="gap-x-1.5">
      <span className="mr-1.5 font-semibold tabular-nums">
        {ids.length} {ids.length === 1 ? "selecionado" : "selecionados"}
      </span>
      {left > 0 ? (
        <Hint
          label="Sem e-mail, descadastrados ou já contatados não recebem o primeiro e-mail"
          side="top"
        >
          <span tabIndex={0} className="mr-1 text-xs text-orange outline-none max-sm:hidden">
            {left} {left === 1 ? "fica" : "ficam"} de fora do disparo
          </span>
        </Hint>
      ) : null}
      <DisabledReason reason={dispatchReason} side="top">
        <Button size="sm" disabled={Boolean(dispatchReason)} onClick={onDispatch}>
          <SendIcon />
          Disparar
        </Button>
      </DisabledReason>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            className="text-current hover:text-current"
          >
            <ArrowRightCircleIcon />
            <span className="max-sm:hidden">Mudar etapa</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="min-w-44">
          {BULK_STATUSES.map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onMove(status)}>
              {LEAD_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onDiscard}
        className="text-current hover:text-current"
      >
        <Trash2Icon />
        <span className="max-sm:hidden">Descartar</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => exportForm.current?.requestSubmit()}
        className="text-current hover:text-current"
      >
        <DownloadIcon />
        <span className="max-sm:hidden">Exportar</span>
      </Button>
      <span aria-hidden className="mx-1 h-5 w-px bg-current/15" />
      <Hint label="Limpar seleção" side="top">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Limpar seleção"
          onClick={onClear}
          className="text-current hover:text-current"
        >
          <XIcon />
        </Button>
      </Hint>
      {/* Posted, not a link: a long selection does not fit in a URL. */}
      <form ref={exportForm} method="post" action="/api/leads.csv" hidden>
        <input type="hidden" name="ids" value={ids.slice(0, EXPORT_SELECTION_LIMIT).join(",")} />
      </form>
    </FloatingBar>
  );
}
