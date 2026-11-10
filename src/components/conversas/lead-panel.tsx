import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  RotateCcwIcon,
  SparklesIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Avatar, type Tone } from "@/components/apple-ui";
import { StatusLabel } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/db/schema";
import { SCORE_TIERS } from "@/lib/schemas";
import { scoreLabel, scoreLevel } from "@/lib/score-label";
import type { ConversationState } from "@/server/mail";
import { ConversationStateLabel } from "./conversation-state-label";
import { LeadContactTiles } from "./lead-contact-tiles";
import { LeadFacts } from "./lead-facts";

type PanelLead = Pick<
  Lead,
  "id" | "name" | "phone" | "phoneE164" | "website" | "rating" | "reviewCount" | "score"
>;

const SCORE_TONE: Record<keyof typeof SCORE_TIERS, Tone> = {
  high: "green",
  medium: "orange",
  low: "gray",
};

function ScoreLabel({ score }: { score: number | null }) {
  if (score === null) return null;
  return (
    <StatusLabel icon={TrendingUpIcon} tone={SCORE_TONE[scoreLevel(score)]}>
      Nota {scoreLabel(score).toLowerCase()}
    </StatusLabel>
  );
}

/** Fechar negócio and Encerrar sem negócio, or Reabrir once the conversation is closed. */
function DealButtons({
  closed,
  blocker,
  busy,
  onWon,
  onLost,
  onReopen,
}: {
  closed: boolean;
  blocker: string | null;
  busy: { closing: boolean; reopening: boolean };
  onWon: () => void;
  onLost: () => void;
  onReopen: () => void;
}) {
  if (closed) {
    return (
      <Button
        variant="outline"
        className="justify-start"
        disabled={Boolean(blocker) || busy.reopening}
        onClick={onReopen}
      >
        <RotateCcwIcon aria-hidden />
        {busy.reopening ? "Reabrindo…" : "Reabrir conversa"}
      </Button>
    );
  }
  return (
    <>
      <Button variant="outline" className="justify-start" disabled={busy.closing} onClick={onWon}>
        <CircleCheckIcon aria-hidden className="text-green" />
        Fechar negócio
      </Button>
      <Button
        variant="destructive"
        className="justify-start"
        disabled={busy.closing}
        onClick={onLost}
      >
        <CircleXIcon aria-hidden />
        Encerrar sem negócio
      </Button>
    </>
  );
}

/**
 * Everything about the lead beside the conversation: who it is, how to reach them, what the AI
 * found and how to close the deal. Bordered cards on the page background, no shadows.
 */
export function LeadPanel({
  lead,
  state,
  summary,
  closed,
  blocker,
  busy,
  onWon,
  onLost,
  onReopen,
}: {
  lead: PanelLead;
  state: ConversationState;
  summary: string | null;
  closed: boolean;
  blocker: string | null;
  busy: { closing: boolean; reopening: boolean };
  onWon: () => void;
  onLost: () => void;
  onReopen: () => void;
}) {
  return (
    <aside
      aria-label="Dados do lead"
      className="enter hidden min-h-0 content-start gap-2.5 overflow-x-hidden overflow-y-auto overscroll-contain border-l border-border px-4 py-4 xl:grid"
      style={{ animationDelay: "80ms" }}
    >
      <div className="grid gap-2.5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} size={48} />
          <p className="min-w-0 text-[17px] leading-tight font-semibold">{lead.name}</p>
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
          <ConversationStateLabel state={state} />
          <ScoreLabel score={lead.score} />
        </div>
      </div>

      <LeadContactTiles phone={lead.phone} phoneE164={lead.phoneE164} website={lead.website} />
      <LeadFacts
        phone={lead.phone}
        website={lead.website}
        rating={lead.rating}
        reviewCount={lead.reviewCount}
      />

      {summary ? (
        <div className="grid gap-2 rounded-2xl border border-border bg-card px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <SparklesIcon aria-hidden className="size-3.5 text-purple" />
            Resumo da IA
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      ) : null}

      <div className="grid gap-2 pt-1">
        <DealButtons
          closed={closed}
          blocker={blocker}
          busy={busy}
          onWon={onWon}
          onLost={onLost}
          onReopen={onReopen}
        />
        {blocker ? <p className="px-1 text-[13px] text-muted-foreground">{blocker}</p> : null}
        <Button asChild variant="link" className="justify-between">
          <Link to="/leads" search={{ view: "all", lead: lead.id }}>
            Ver análise completa
            <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
