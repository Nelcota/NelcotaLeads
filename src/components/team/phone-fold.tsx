import { ChevronDownIcon } from "@/components/icons";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A card body that starts collapsed on a phone (a summary line opens it) and is always open
 * from `lg` up (decided 2026-11-09: Atividade and Convites sit at the end of a long page).
 */
export function PhoneFold({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="-mx-2 flex min-h-11 w-[calc(100%+16px)] items-center gap-2 rounded-[10px] px-2 text-left text-base text-muted-foreground outline-none hover:bg-fill-2 focus-visible:bg-fill-2 lg:hidden"
      >
        <span className="flex-1">{summary}</span>
        <span className="text-sm font-semibold text-blue">{open ? "Fechar" : "Abrir"}</span>
        <ChevronDownIcon
          aria-hidden
          className={cn("size-4 shrink-0 text-tertiary transition-transform", open && "rotate-180")}
        />
      </button>
      <div id={bodyId} className={cn(!open && "max-lg:hidden")}>
        {children}
      </div>
    </>
  );
}
