import { UserIcon } from "lucide-react";
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
      {/* Badge standard: a line icon in the status color, then neutral text. */}
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <UserIcon
          className={ownerName ? "size-3.5 text-blue" : "size-3.5 text-gray"}
          strokeWidth={1.9}
        />
        {ownerName ? `Com ${ownerName}` : "Livre"}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={mine ? onRelease : onTake}
        className="ml-1"
      >
        {mine ? "Liberar" : "Assumir"}
      </Button>
    </span>
  );
}
