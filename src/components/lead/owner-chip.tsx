import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Who has the lead: "Com Haniel" or "Livre", with "Assumir" (take it, also from someone else)
 * or "Liberar" when it is the signed-in person's.
 */
export function OwnerChip({
  ownerName,
  mine,
  busy,
  onTake,
  onRelease,
}: {
  ownerName: string | null;
  mine: boolean;
  busy: boolean;
  onTake: () => void;
  onRelease: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={ownerName ? "blue" : "gray"}>
        {ownerName ? `Com ${ownerName}` : "Livre"}
      </Badge>
      <Button
        variant="ghost"
        size="xs"
        disabled={busy}
        onClick={mine ? onRelease : onTake}
        className="text-blue hover:text-blue"
      >
        {mine ? "Liberar" : "Assumir"}
      </Button>
    </span>
  );
}
