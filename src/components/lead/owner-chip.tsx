import { UserIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Who has the lead: "Com Haniel" or "Sem responsável", with "Assumir lead" (take it, also from someone
 * else) or "Deixar sem responsável" when it is the signed-in person's.
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
        <UserIcon className={ownerName ? "size-3.5 text-blue" : "size-3.5 text-gray"} />
        {ownerName ? `Com ${ownerName}` : "Sem responsável"}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={mine ? onRelease : onTake}
        className="ml-1"
      >
        {mine ? "Deixar sem responsável" : "Assumir lead"}
      </Button>
    </span>
  );
}
