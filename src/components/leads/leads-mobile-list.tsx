import { FilterXIcon, InboxIcon, PhoneIcon } from "@/components/icons";
import { EmptyState } from "@/components/apple-ui";
import { WhatsAppMark } from "@/components/brand-marks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { LIST_CHECKBOX, ReadyMark, ScoreCell } from "@/components/leads/lead-cells";
import type { EmptyInfo } from "@/components/leads/leads-table";
import { StageLabel } from "@/components/leads/stage-label";
import { isReadyToDispatch, leadStage } from "@/lib/lead-row";
import { whatsappLink } from "@/lib/phone";
import type { LeadRow } from "@/server/leads-query";

/** Phones: one compact row per lead, with WhatsApp and Ligar always in reach. No sideways scroll. */
export function LeadsMobileList({
  rows,
  loading,
  empty,
  selected,
  onToggle,
  onOpen,
}: {
  rows: LeadRow[];
  loading: boolean;
  empty: EmptyInfo;
  selected: ReadonlySet<string>;
  onToggle: (ids: string[], on: boolean) => void;
  onOpen: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-2 p-3 lg:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={empty.action ? FilterXIcon : InboxIcon}
        title={empty.title}
        className="py-10 lg:hidden"
      >
        {empty.action ? (
          <Button variant="outline" size="sm" onClick={empty.action.onClick}>
            {empty.action.label}
          </Button>
        ) : null}
      </EmptyState>
    );
  }
  return (
    <ul className="lg:hidden">
      {rows.map((lead) => {
        const checked = selected.has(lead.id);
        const pending = lead.analysisStatus === "pending";
        return (
          <li
            key={lead.id}
            data-state={checked ? "selected" : undefined}
            className="flex min-h-16 items-center border-b border-border last:border-0 data-[state=selected]:bg-sidebar-accent"
          >
            <label className="grid h-16 w-12 shrink-0 cursor-pointer place-items-center">
              <Checkbox
                className={LIST_CHECKBOX}
                aria-label={`Selecionar ${lead.name}`}
                checked={checked}
                disabled={pending}
                onCheckedChange={(value) => onToggle([lead.id], value === true)}
              />
            </label>
            <button
              type="button"
              onClick={() => onOpen(lead.id)}
              className="flex min-w-0 flex-1 flex-col gap-1 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="truncate">{lead.name}</span>
                {isReadyToDispatch(lead) ? <ReadyMark /> : null}
              </span>
              <span className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <ScoreCell score={lead.score} pending={pending} />
                  {pending ? <span className="text-muted-foreground">Analisando</span> : null}
                </span>
                <StageLabel stage={leadStage(lead)} className="font-normal text-muted-foreground" />
              </span>
            </button>
            {lead.phoneE164 ? (
              <span className="flex shrink-0 gap-1 pr-2">
                <Button asChild variant="ghost" size="icon" className="text-green">
                  <a
                    href={whatsappLink(lead.phoneE164)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`WhatsApp ${lead.phone ?? ""}`}
                  >
                    <WhatsAppMark className="size-[18px]" />
                  </a>
                </Button>
                <Button asChild variant="ghost" size="icon">
                  <a href={`tel:${lead.phoneE164}`} aria-label={`Ligar para ${lead.phone ?? ""}`}>
                    <PhoneIcon />
                  </a>
                </Button>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
