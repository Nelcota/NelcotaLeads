import { CircleXIcon } from "@/components/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LostDeal, WonDeal } from "@/lib/deal-form";
import type { ProposalItem } from "@/lib/schemas";
import { CloseLostForm } from "./close-lost-form";
import { CloseWonForm } from "./close-won-form";

type Mode = "idle" | "won" | "lost";

/** "Fechar negócio" and "Marcar como perdido", each opening its form in place of the buttons. */
export function DealActions({
  today,
  proposal,
  busy,
  primary = true,
  onWon,
  onLost,
}: {
  today: string;
  /** The lead's latest proposal, which "Fechar negócio" starts from. */
  proposal: { items: ProposalItem[]; totalCents: number } | null;
  busy: boolean;
  /** Whether closing is the main action of the card (solid blue); one per card. */
  primary?: boolean;
  onWon: (deal: WonDeal) => void;
  onLost: (deal: LostDeal) => void;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const back = () => setMode("idle");
  if (mode === "won") {
    return (
      <CloseWonForm today={today} proposal={proposal} busy={busy} onConfirm={onWon} onBack={back} />
    );
  }
  if (mode === "lost") return <CloseLostForm busy={busy} onConfirm={onLost} onBack={back} />;
  return (
    <div className="flex w-full flex-wrap gap-2">
      <Button
        size="sm"
        variant={primary ? "default" : "outline"}
        disabled={busy}
        onClick={() => setMode("won")}
      >
        Fechar negócio
      </Button>
      <Button
        size="sm"
        variant="destructive"
        className="ml-auto"
        disabled={busy}
        onClick={() => setMode("lost")}
      >
        <CircleXIcon />
        Marcar como perdido
      </Button>
    </div>
  );
}
