import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

/** "+ Adicionar …": green round plus and a blue label, like the rows in Configurações. */
export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press inline-flex items-center gap-2.5 py-1 text-sm font-medium text-blue"
    >
      <span className="grid size-[22px] place-items-center rounded-full bg-green text-primary-foreground">
        <PlusIcon className="size-3" strokeWidth={3} />
      </span>
      {children}
    </button>
  );
}
