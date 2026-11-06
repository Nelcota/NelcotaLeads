import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { agendaRangeSchema } from "@/lib/agenda";
import { localDay, localTime } from "@/lib/format";
import { agendaEntries, teamMembers, todayEntries } from "./agenda-store";

/**
 * The Agenda: meetings and follow-ups from one day to another (the visible Month, Week or Day),
 * the team, and today and now in Brazil time.
 */
export const getAgenda = createServerFn({ method: "GET" })
  .validator(agendaRangeSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const now = new Date();
    const range = { from: data.from, to: data.to, ownerId: data.owner };
    const [entries, team] = await Promise.all([agendaEntries(db, range), teamMembers(db)]);
    return { today: localDay(now), now: localTime(now), entries, team };
  });

export type Agenda = Awaited<ReturnType<typeof getAgenda>>;

/** Today's meetings and follow-ups: the sidebar badge and "Agenda de hoje". */
export const getTodayAgenda = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();
  return { today: localDay(now), entries: await todayEntries(getDb(), now) };
});
