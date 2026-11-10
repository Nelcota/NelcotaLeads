import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarIcon,
  CircleCheckIcon,
  CircleXIcon,
  FileTextIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
import type { LeadEventKind } from "@/db/schema";
import { PERIOD_CAPTIONS, type OverviewPeriod } from "@/lib/period";
import type { ActivityLine } from "@/lib/team-activity";
import { teamLinks } from "@/lib/team-links";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/server/team";
import { PhoneFold } from "./phone-fold";

/** Lines shown before "Ver mais". */
const FIRST_LINES = 6;

const KIND_ICON: Partial<Record<LeadEventKind, { Icon: LucideIcon; tone: string }>> = {
  won: { Icon: CircleCheckIcon, tone: "text-green" },
  lost: { Icon: CircleXIcon, tone: "text-red" },
  meeting: { Icon: CalendarIcon, tone: "text-green" },
  proposal: { Icon: FileTextIcon, tone: "text-yellow" },
  owner: { Icon: UserPlusIcon, tone: "text-blue" },
  stage: { Icon: ArrowRightIcon, tone: "text-teal" },
};

function Line({ line, showDay }: { line: ActivityLine; showDay: boolean }) {
  const icon = KIND_ICON[line.kind] ?? KIND_ICON.stage;
  const Icon = icon?.Icon ?? ArrowRightIcon;
  return (
    <>
      {showDay ? (
        <p className="pt-3.5 pb-0.5 text-sm font-semibold text-tertiary">{line.day}</p>
      ) : null}
      <div className="flex min-h-13 items-start gap-3 py-2">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-fill-2"
        >
          <Icon className={cn("size-[18px]", icon?.tone)} />
        </span>
        <p className="min-w-0 flex-1 text-base leading-snug">
          <span className="font-semibold">{line.who}</span> {line.verb}{" "}
          <Link {...teamLinks.lead(line.leadId)} className="font-semibold hover:underline">
            {line.leadName}
          </Link>
          {line.extra ? (
            <span className="block text-sm text-muted-foreground">{line.extra}</span>
          ) : null}
        </p>
        <span className="shrink-0 pt-0.5 text-sm whitespace-nowrap text-tertiary">{line.when}</span>
      </div>
    </>
  );
}

/** The phone's closed line: "4 ações hoje", or how many in the period when none was today. */
function activitySummary(lines: ActivityLine[]): string {
  const today = lines.filter((line) => line.day === "Hoje").length;
  if (today > 0) return `${today} ${today === 1 ? "ação" : "ações"} hoje`;
  return lines.length === 0 ? "Nada nesse período" : `${lines.length} ações no período`;
}

/** "Atividade da equipe": who took, booked, proposed, closed or lost what, filterable by person. */
export function TeamActivity({
  lines,
  members,
  period,
}: {
  lines: ActivityLine[];
  members: TeamMember[];
  period: OverviewPeriod;
}) {
  const [who, setWho] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const filtered = who ? lines.filter((line) => line.whoId === who) : lines;
  const shown = expanded ? filtered : filtered.slice(0, FIRST_LINES);
  const hidden = filtered.length - shown.length;
  const pick = (id: string | null) => {
    setWho(id);
    setExpanded(false);
  };

  return (
    <section
      className="grouped enter p-5 sm:p-6"
      style={{ animationDelay: "140ms" }}
      aria-labelledby="team-activity"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <h2 id="team-activity" className="text-[20px] font-semibold tracking-[-0.015em]">
          Atividade da equipe
        </h2>
        <span className="text-sm text-tertiary">{PERIOD_CAPTIONS[period]}</span>
      </div>
      <PhoneFold summary={activitySummary(lines)}>
        <div
          role="group"
          aria-label="Filtrar por sócio"
          className="flex flex-wrap gap-1.5 pt-3 pb-1"
        >
          <ChoicePill
            selected={who === null}
            aria-pressed={who === null}
            onClick={() => pick(null)}
          >
            Todos
          </ChoicePill>
          {members.map((member) => (
            <ChoicePill
              key={member.id}
              selected={who === member.id}
              aria-pressed={who === member.id}
              onClick={() => pick(member.id)}
            >
              {member.name}
            </ChoicePill>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="flex min-h-13 items-center text-base text-muted-foreground">
            Nada nesse período.
          </p>
        ) : (
          shown.map((line, index) => (
            <Line
              key={line.id}
              line={line}
              showDay={index === 0 || shown[index - 1]?.day !== line.day}
            />
          ))
        )}
        {hidden > 0 ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setExpanded(true)}>
            Ver mais {hidden}
          </Button>
        ) : null}
        {expanded && filtered.length > FIRST_LINES ? (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExpanded(false)}>
            Ver menos
          </Button>
        ) : null}
      </PhoneFold>
    </section>
  );
}
