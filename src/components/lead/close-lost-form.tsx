import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LostDeal } from "@/lib/deal-form";
import { LOSS_REASON_LABELS, LOSS_REASONS, type LossReason } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const NOTE_MAX = 500;

/** "Encerrar sem negócio": one reason (required) from the list and an optional note. */
export function CloseLostForm({
  busy,
  onConfirm,
  onBack,
}: {
  busy: boolean;
  onConfirm: (deal: LostDeal) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = useState<LossReason | null>(null);
  const [note, setNote] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason) return;
    onConfirm({ reason, note: note.trim() || undefined });
  };

  return (
    <form className="grid w-full gap-3" onSubmit={submit}>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Motivo</legend>
        <div role="radiogroup" aria-label="Motivo" className="flex flex-wrap gap-1.5">
          {LOSS_REASONS.map((item) => (
            <ReasonChip
              key={item}
              label={LOSS_REASON_LABELS[item]}
              selected={reason === item}
              onSelect={() => setReason(item)}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="loss-note">Nota (opcional)</Label>
        <Textarea
          id="loss-note"
          rows={2}
          maxLength={NOTE_MAX}
          placeholder="O que aconteceu, para lembrar depois."
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={busy || !reason}>
          {busy ? "Encerrando…" : "Encerrar lead"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}

function ReasonChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "h-7 rounded-full px-3 text-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected ? "bg-primary text-primary-foreground" : "bg-fill-2 text-foreground hover:bg-fill",
      )}
    >
      {label}
    </button>
  );
}
