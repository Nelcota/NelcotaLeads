import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LostDeal, WonDeal } from "@/lib/deal-form";
import type { ProposalItem } from "@/lib/schemas";
import { CloseLostForm } from "./close-lost-form";
import { CloseWonForm } from "./close-won-form";

export type CloseDealMode = "won" | "lost";

const COPY: Record<CloseDealMode, { title: string; description: string }> = {
  won: {
    title: "Fechar negócio",
    description: "O valor, o dia e o serviço vendido entram na meta e nas métricas.",
  },
  lost: {
    title: "Encerrar sem negócio",
    description: "O motivo entra nas métricas de perda do nicho.",
  },
};

/**
 * The same won and lost forms as the lead panel, in a dialog (Conversas has no room inline).
 * `mode` null keeps it closed; it closes itself on "Voltar" and the caller closes it once the
 * server accepted the close.
 */
export function CloseDealDialog({
  mode,
  leadName,
  today,
  proposal,
  busy,
  onWon,
  onLost,
  onClose,
}: {
  mode: CloseDealMode | null;
  leadName: string;
  today: string;
  /** The lead's latest proposal, which "Fechar negócio" starts from. */
  proposal: { items: ProposalItem[]; totalCents: number } | null;
  busy: boolean;
  onWon: (deal: WonDeal) => void;
  onLost: (deal: LostDeal) => void;
  onClose: () => void;
}) {
  const copy = mode ? COPY[mode] : null;
  return (
    <Dialog open={mode !== null} onOpenChange={(open) => (open || busy ? undefined : onClose())}>
      <DialogContent className="sm:max-w-[440px]">
        {copy ? (
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {leadName}. {copy.description}
            </DialogDescription>
          </DialogHeader>
        ) : null}
        {mode === "won" ? (
          <CloseWonForm
            today={today}
            proposal={proposal}
            busy={busy}
            onConfirm={onWon}
            onBack={onClose}
          />
        ) : null}
        {mode === "lost" ? <CloseLostForm busy={busy} onConfirm={onLost} onBack={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}
