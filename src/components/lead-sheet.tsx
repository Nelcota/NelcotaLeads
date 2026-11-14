import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { useEffect, useRef } from "react";
import { Hint } from "@/components/apple-ui";
import { LeadDetail } from "@/components/lead-detail";
import { UnsavedEditsScope, useUnsavedEditsGuard } from "@/components/unsaved-edits";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useListHotkeys } from "@/hooks/use-list-hotkeys";
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

  const open = Boolean(leadId);
  useListHotkeys(open, {
    onNext: nextId ? () => go(nextId) : undefined,
    onPrev: prevId ? () => go(prevId) : undefined,
  });

  return (
    <Sheet open={open} onOpenChange={(value) => !value && go(undefined)}>
      <SheetContent
        // Solid panel (no glass or drop shadow): 1px outline and the 28px panel radius.
        className="w-full gap-0 overflow-y-auto border border-foreground/15 bg-card shadow-none! data-[side=right]:rounded-[28px] data-[side=right]:sm:max-w-[600px]"
        onEscapeKeyDown={(event) => {
          // Esc in a field being edited in place cancels that edit, not the whole panel.
          if (event.target instanceof Element && event.target.closest("[data-inline-edit]")) {
            event.preventDefault();
          }
        }}
      >
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
                  <div className="flex items-center gap-2 pr-10 text-sm font-medium text-muted-foreground">
                    <div className="flex gap-2">
                      <Hint label="Anterior (K)">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Lead anterior (K)"
                          disabled={!prevId}
                          onClick={() => prevId && go(prevId)}
                        >
                          <ChevronLeftIcon />
                        </Button>
                      </Hint>
                      <Hint label="Próximo (J)">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="Próximo lead (J)"
                          disabled={!nextId}
                          onClick={() => nextId && go(nextId)}
                        >
                          <ChevronRightIcon />
                        </Button>
                      </Hint>
                    </div>
                    <span className="tabular-nums">
                      {position + 1} de {ids.length}
                    </span>
                    <span className="hidden gap-1 sm:flex" aria-hidden>
                      <kbd className="grid h-5 min-w-5 place-items-center rounded-md border border-foreground/15 px-1 text-2xs font-semibold text-muted-foreground">
                        K
                      </kbd>
                      <kbd className="grid h-5 min-w-5 place-items-center rounded-md border border-foreground/15 px-1 text-2xs font-semibold text-muted-foreground">
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
