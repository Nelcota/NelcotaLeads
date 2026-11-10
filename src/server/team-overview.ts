import { asc } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import { localDay } from "@/lib/format";
import { monthOf, monthRange } from "@/lib/goal";
import { periodRange, previousRange, type OverviewPeriod } from "@/lib/period";
import { monthlyGoalStatus } from "./goal-store";
import { teamActivity } from "./team-activity-store";
import { freeLeads } from "./team-free-store";
import { heldByOwner, meetingsByOwner, proposalsByOwner, wonByOwner } from "./team-stats-store";
import { followUpsByOwner, nextMeetingByOwner, waitingByOwner } from "./team-today-store";

const NO_DEALS = { deals: 0, revenueCents: 0 };

function teamMembers(db: Db) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      since: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt), asc(users.name));
}

/** Everything the per-partner columns need, for the period and for today. */
async function memberFigures(db: Db, period: OverviewPeriod, now: Date) {
  const range = periodRange(period, now);
  const today = localDay(now);
  const [held, won, previous, month, meetingCounts, proposalCounts, followUps, waiting, next] =
    await Promise.all([
      heldByOwner(db),
      wonByOwner(db, range),
      wonByOwner(db, previousRange(period, now)),
      wonByOwner(db, monthRange(monthOf(today))),
      meetingsByOwner(db, range),
      proposalsByOwner(db, range),
      followUpsByOwner(db, today),
      waitingByOwner(db),
      nextMeetingByOwner(db, now),
    ]);
  return { held, won, previous, month, meetingCounts, proposalCounts, followUps, waiting, next };
}

type Figures = Awaited<ReturnType<typeof memberFigures>>;

function memberRow(member: Awaited<ReturnType<typeof teamMembers>>[number], figures: Figures) {
  const id = member.id;
  const held = figures.held.get(id);
  const followUps = figures.followUps.get(id);
  return {
    ...member,
    held: held?.held ?? 0,
    talking: held?.talking ?? 0,
    meetings: figures.meetingCounts.get(id) ?? 0,
    proposals: figures.proposalCounts.get(id) ?? 0,
    won: figures.won.get(id) ?? NO_DEALS,
    previousDeals: figures.previous.get(id)?.deals ?? 0,
    month: figures.month.get(id) ?? NO_DEALS,
    today: {
      due: followUps?.due ?? 0,
      late: followUps?.late ?? 0,
      waiting: figures.waiting.get(id) ?? 0,
      nextMeeting: figures.next.get(id) ?? null,
    },
  };
}

/** The Equipe page: partners with their numbers, the goal, free leads and the team's activity. */
export async function teamOverview(db: Db, period: OverviewPeriod, now: Date) {
  const [members, figures, goal, free, activity] = await Promise.all([
    teamMembers(db),
    memberFigures(db, period, now),
    monthlyGoalStatus(db, monthOf(localDay(now))),
    freeLeads(db),
    teamActivity(db, periodRange(period, now)),
  ]);
  return {
    period,
    today: localDay(now),
    members: members.map((member) => memberRow(member, figures)),
    goal,
    free,
    activity,
  };
}
