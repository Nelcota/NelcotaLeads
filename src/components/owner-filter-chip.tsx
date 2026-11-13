import { XIcon } from "@/components/icons";
import { useMemberName } from "@/hooks/use-member-name";

/** "Dono: Phellipe ×": the owner filter a link from the Equipe page left on, removable. */
export function OwnerFilterChip({ owner, onClear }: { owner: string; onClear: () => void }) {
  const label = `Dono: ${useMemberName(owner)}`;
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
