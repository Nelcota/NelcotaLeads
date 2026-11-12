import { ChevronDownIcon, FilterXIcon, InboxIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadAvatar } from "@/components/leads/lead-avatar";
import {
  LIST_CHECKBOX,
  NextStepCell,
  OwnerCell,
  RatingCell,
  ReadyMark,
  ScoreCell,
} from "@/components/leads/lead-cells";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { StageLabel } from "@/components/leads/stage-label";
import { isFresh, isReadyToDispatch, leadStage, nextStep, scoreReasons } from "@/lib/lead-row";
import type { LeadView } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/server/leads-query";
import { leadHint } from "@/components/leads/lead-hint";
import { LeadHintIcon } from "@/components/leads/lead-hint-icon";
import { useMediaQuery } from "@/hooks/use-media-query";

type StepView = "followup" | "waiting" | "talking" | "other";

function stepViewOf(view: LeadView): StepView {
  return view === "followup" || view === "waiting" || view === "talking" ? view : "other";
}

export type SortKey = "name" | "score" | "rating";
export type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

export type EmptyInfo = { title: string; action?: { label: string; onClick: () => void } };

export const EMPTY_VIEW_TEXT: Record<LeadView, string> = {
  todo: "Nenhum lead novo para contatar.",
  followup: "Nada para retornar hoje.",
  waiting: "Ninguém aguardando resposta.",
  talking: "Nenhuma conversa em andamento.",
  closed: "Nenhum negócio fechado ainda.",
  discarded: "Nenhum lead descartado.",
  all: "Nenhum lead.",
};

const NEXT_STEP_HEAD: Partial<Record<LeadView, string>> = {
  followup: "Retorno",
  waiting: "Último envio",
};

export type RowHandlers = {
  onToggle: (ids: string[], on: boolean) => void;
  onOpen: (id: string) => void;
  onWriteEmail: (id: string) => void;
  onMove: (id: string, status: "contacted" | "replied") => void;
  onDiscard: (id: string) => void;
};

function SortHeader({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (column: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === column;
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-[13px] font-medium text-tertiary",
        className,
      )}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex h-7 items-center gap-1 rounded-[6px] hover:text-foreground"
      >
        {label}
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-3 transition-[opacity,transform] duration-150",
            active ? "text-foreground opacity-100" : "opacity-0",
            active && sort.dir === "asc" && "rotate-180",
          )}
        />
      </button>
    </th>
  );
}

function Head({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-[13px] font-medium text-tertiary",
        className,
      )}
    >
      {children}
    </th>
  );
}

/**
 * The desktop table: fixed column widths so it never scrolls sideways. "Próximo passo" shows
 * in every tab but "A contatar".
 */
export function LeadsTable({
  rows,
  loading,
  view,
  empty,
  selected,
  sort,
  onSort,
  handlers,
  busy,
  today,
  now,
}: {
  rows: LeadRow[];
  loading: boolean;
  view: LeadView;
  empty: EmptyInfo;
  selected: ReadonlySet<string>;
  sort: SortState;
  onSort: (column: SortKey) => void;
  handlers: RowHandlers;
  busy: boolean;
  today: string;
  now: Date;
}) {
  const showNext = view !== "todo";
  // Google is the first column to go when the panel is narrow.
  const wide = useMediaQuery("(min-width: 1280px)");
  // Then the owner, so the company name keeps room on a medium screen.
  const roomy = useMediaQuery("(min-width: 1200px)");
  const columns = 5 + (showNext ? 1 : 0) + (wide ? 1 : 0) + (roomy ? 1 : 0);
  const selectable = rows
    .filter((lead) => lead.analysisStatus !== "pending")
    .map((lead) => lead.id);
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.has(id));
  const someSelected = !allSelected && selectable.some((id) => selected.has(id));

  return (
    <table className="w-full table-fixed border-collapse text-sm max-lg:hidden">
      <colgroup>
        <col className="w-12" />
        <col />
        <col className="w-[96px]" />
        <col className="w-[128px]" />
        {showNext ? <col className="w-[152px]" /> : null}
        {roomy ? <col className="w-[56px]" /> : null}
        {wide ? <col className="w-[96px]" /> : null}
        <col className="w-[164px]" />
      </colgroup>
      <thead className="border-b border-border">
        <tr>
          <Head className="pl-4">
            <Checkbox
              className={LIST_CHECKBOX}
              aria-label="Selecionar os leads desta página"
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => handlers.onToggle(selectable, checked === true)}
              disabled={selectable.length === 0}
            />
          </Head>
          <SortHeader label="Empresa" column="name" sort={sort} onSort={onSort} />
          <SortHeader label="Nota" column="score" sort={sort} onSort={onSort} />
          <Head>Etapa</Head>
          {showNext ? <Head>{NEXT_STEP_HEAD[view] ?? "Próximo passo"}</Head> : null}
          {roomy ? (
            <Head>
              <Hint label="Responsável">
                <span tabIndex={0} aria-label="Responsável" className="outline-none">
                  Resp.
                </span>
              </Hint>
            </Head>
          ) : null}
          {wide ? <SortHeader label="Google" column="rating" sort={sort} onSort={onSort} /> : null}
          <Head className="pr-5 text-right">
            <span className="sr-only">Ações</span>
          </Head>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          Array.from({ length: 6 }, (_, index) => (
            <tr key={index} className="border-b border-border last:border-0">
              <td colSpan={columns} className="px-4 py-2.5">
                <Skeleton className="h-9 w-full" />
              </td>
            </tr>
          ))
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={columns}>
              <EmptyState
                icon={empty.action ? FilterXIcon : InboxIcon}
                title={empty.title}
                className="py-12"
              >
                {empty.action ? (
                  <Button variant="outline" size="sm" onClick={empty.action.onClick}>
                    {empty.action.label}
                  </Button>
                ) : null}
              </EmptyState>
            </td>
          </tr>
        ) : (
          rows.map((lead) => (
            <LeadTableRow
              key={lead.id}
              lead={lead}
              showNext={showNext}
              stepView={stepViewOf(view)}
              wide={wide}
              roomy={roomy}
              selected={selected.has(lead.id)}
              handlers={handlers}
              busy={busy}
              today={today}
              now={now}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

function LeadTableRow({
  lead,
  showNext,
  stepView,
  wide,
  roomy,
  selected,
  handlers,
  busy,
  today,
  now,
}: {
  lead: LeadRow;
  showNext: boolean;
  stepView: StepView;
  wide: boolean;
  roomy: boolean;
  selected: boolean;
  handlers: RowHandlers;
  busy: boolean;
  today: string;
  now: Date;
}) {
  const pending = lead.analysisStatus === "pending";
  const hint = leadHint(lead);
  const fresh = !pending && isFresh(lead.createdAt, now);
  return (
    <tr
      tabIndex={0}
      data-lead-id={lead.id}
      data-state={selected ? "selected" : undefined}
      aria-label={lead.name}
      className={cn(
        "group/row h-[54px] cursor-pointer border-b border-border outline-none transition-colors last:border-0",
        "hover:bg-fill-2 focus-visible:bg-fill-2 focus-visible:shadow-[inset_0_0_0_2px_color-mix(in_srgb,var(--ring)_75%,transparent)]",
        "data-[state=selected]:bg-sidebar-accent",
        pending && "text-tertiary",
      )}
      onClick={() => handlers.onOpen(lead.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) handlers.onOpen(lead.id);
      }}
    >
      <td className="pl-4" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          className={LIST_CHECKBOX}
          aria-label={`Selecionar ${lead.name}`}
          checked={selected}
          disabled={pending}
          onCheckedChange={(checked) => handlers.onToggle([lead.id], checked === true)}
        />
      </td>
      <td className="px-3">
        <div className="flex min-w-0 items-center gap-3">
          <LeadAvatar name={lead.name} website={lead.website} />
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
              <span className="truncate">{lead.name}</span>
              {isReadyToDispatch(lead) ? <ReadyMark /> : null}
            </p>
            <p
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-[13px] text-tertiary",
                hint.tone && "font-medium",
              )}
              style={hint.tone ? { color: hint.tone } : undefined}
            >
              <LeadHintIcon text={hint.text} />
              <span className="truncate">
                {hint.text}
                {fresh ? (
                  <span className="font-semibold text-blue">{hint.text ? " · " : ""}Novo hoje</span>
                ) : null}
              </span>
            </p>
          </div>
        </div>
      </td>
      <td className="px-3">
        <ScoreCell score={lead.score} pending={pending} reasons={scoreReasons(lead)} />
      </td>
      <td className="truncate px-3">
        <StageLabel stage={leadStage(lead)} />
      </td>
      {showNext ? (
        <td className="truncate px-3">
          <NextStepCell step={nextStep(lead, today, now, stepView)} />
        </td>
      ) : null}
      {roomy ? (
        <td className="px-3">
          <OwnerCell name={lead.ownerName} avatar={lead.ownerAvatar} />
        </td>
      ) : null}
      {wide ? (
        <td className="truncate px-3">
          <RatingCell rating={lead.rating} reviews={lead.reviewCount} />
        </td>
      ) : null}
      <td className="pr-5 pl-3">
        {pending ? null : (
          <LeadRowActions
            lead={lead}
            busy={busy}
            onWriteEmail={handlers.onWriteEmail}
            onMove={handlers.onMove}
            onDiscard={handlers.onDiscard}
          />
        )}
      </td>
    </tr>
  );
}
