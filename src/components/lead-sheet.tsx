import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
        className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-[640px]"
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
                  <div className="flex items-center gap-2.5 pr-10 text-[14px] font-medium text-muted-foreground">
                    <div className="flex rounded-full bg-fill-2 p-0.5">
                      <Hint label="Anterior (K)">
                        <Button
                          variant="ghost"
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
                          variant="ghost"
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
                      <kbd className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-fill-2 px-1 text-[12px] text-muted-foreground">
                        K
                      </kbd>
                      <kbd className="grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-fill-2 px-1 text-[12px] text-muted-foreground">
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
