import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { LeadDetail } from "@/components/lead-detail";
import { UnsavedEditsScope, useUnsavedEditsGuard } from "@/components/unsaved-edits";
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

  // Text without a server draft (the WhatsApp message) asks before it is dropped.
  const { guard, report, dialog } = useUnsavedEditsGuard();
  const go = (id: string | undefined) => guard(() => onSelect(id));

  const handlers = useRef({ prevId, nextId, go });
  useEffect(() => {
    handlers.current = { prevId, nextId, go };
  });
  const open = Boolean(leadId);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const { prevId: prev, nextId: next, go: select } = handlers.current;
      if (event.key === "j" && next) select(next);
      if (event.key === "k" && prev) select(prev);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={(value) => !value && go(undefined)}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-[640px]">
        {dialog}
        {leadId ? (
          <UnsavedEditsScope value={report}>
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
                  <div className="flex items-center gap-2.5 pr-10 text-[12.5px] font-medium text-muted-foreground">
                    <div className="flex rounded-full bg-fill-2 p-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Lead anterior (K)"
                        title="Anterior (K)"
                        disabled={!prevId}
                        onClick={() => prevId && go(prevId)}
                      >
                        <ChevronLeftIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Próximo lead (J)"
                        title="Próximo (J)"
                        disabled={!nextId}
                        onClick={() => nextId && go(nextId)}
                      >
                        <ChevronRightIcon />
                      </Button>
                    </div>
                    <span className="tabular-nums">
                      {position + 1} de {ids.length}
                    </span>
                    <span className="hidden gap-1 sm:flex" aria-hidden>
                      <kbd className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-fill-2 px-1 text-[10.5px] text-muted-foreground">
                        K
                      </kbd>
                      <kbd className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-fill-2 px-1 text-[10.5px] text-muted-foreground">
                        J
                      </kbd>
                    </span>
                  </div>
                ) : null
              }
            />
          </UnsavedEditsScope>
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
