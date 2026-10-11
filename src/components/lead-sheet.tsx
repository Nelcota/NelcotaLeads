import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { LeadDetail } from "@/components/lead-detail";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { LeadStatus } from "@/db/schema";

/**
 * The lead side sheet used by every list: previous/next (also J and K), and after a
 * status change that takes the lead out of the list it moves on to the next one.
 */
export function LeadSheet({
  leadId,
  ids,
  onSelect,
  keepsLead,
}: {
  leadId: string | undefined;
  ids: string[];
  onSelect: (id: string | undefined) => void;
  keepsLead: (status: LeadStatus) => boolean;
}) {
  const position = leadId ? ids.indexOf(leadId) : -1;
  const prevId = position > 0 ? ids[position - 1] : undefined;
  const nextId = position >= 0 ? ids[position + 1] : undefined;

  // Neighbors from the last render where the lead was still listed.
  const neighbors = useRef({ prevId, nextId });
  useEffect(() => {
    if (position >= 0) neighbors.current = { prevId, nextId };
  }, [position, prevId, nextId]);

  const handlers = useRef({ prevId, nextId, onSelect });
  useEffect(() => {
    handlers.current = { prevId, nextId, onSelect };
  });
  const open = Boolean(leadId);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const { prevId: prev, nextId: next, onSelect: select } = handlers.current;
      if (event.key === "j" && next) select(next);
      if (event.key === "k" && prev) select(prev);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onSelect(undefined)}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl">
        {leadId ? (
          <LeadDetail
            key={leadId}
            leadId={leadId}
            onStatusChanged={(status) => {
              if (!keepsLead(status)) {
                onSelect(neighbors.current.nextId ?? neighbors.current.prevId);
              }
            }}
            toolbar={
              position >= 0 ? (
                <div className="flex items-center gap-1 pr-8 text-sm text-muted-foreground">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Lead anterior (K)"
                    title="Anterior (K)"
                    disabled={!prevId}
                    onClick={() => prevId && onSelect(prevId)}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Próximo lead (J)"
                    title="Próximo (J)"
                    disabled={!nextId}
                    onClick={() => nextId && onSelect(nextId)}
                  >
                    <ChevronRightIcon />
                  </Button>
                  <span className="ml-1 tabular-nums">
                    {position + 1} de {ids.length}
                  </span>
                </div>
              ) : null
            }
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      target.closest("[role=listbox]") !== null)
  );
}
