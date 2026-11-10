import { useQuery } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { teamMembersQuery } from "@/lib/queries";

/** "Dono: Phellipe ×": the owner filter a link from the Equipe page left on, removable. */
export function OwnerFilterChip({ owner, onClear }: { owner: string; onClear: () => void }) {
  const { data: members } = useQuery(teamMembersQuery);
  const name = members?.find((member) => member.id === owner)?.name ?? "pessoa removida";
  const label = `Dono: ${name}`;
  return (
    <span className="inline-flex h-8 w-fit items-center gap-1 rounded-full border border-border bg-fill-2 pr-1 pl-3 text-sm font-medium">
      {label}
      <button
        type="button"
        aria-label={`Remover filtro ${label}`}
        onClick={onClear}
        className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-fill hover:text-foreground"
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
