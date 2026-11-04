import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { AGENDA_DAYS, agendaFilterSchema } from "@/lib/agenda";
import { addDays, localDay } from "@/lib/format";
import { agendaEntries, agendaSummary, teamMembers, todayEntries } from "./agenda-store";

/** The Agenda: meetings and follow-ups of the next AGENDA_DAYS days, the tiles and the team. */
export const getAgenda = createServerFn({ method: "GET" })
  .validator(agendaFilterSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const today = localDay(new Date());
    const range = { from: today, to: addDays(today, AGENDA_DAYS - 1), ownerId: data.owner };
    const [entries, summary, team] = await Promise.all([
      agendaEntries(db, range),
      agendaSummary(db, data.owner),
      teamMembers(db),
    ]);
    return { today, entries, summary, team };
  });

export type Agenda = Awaited<ReturnType<typeof getAgenda>>;

/** Today's meetings and follow-ups: the sidebar badge and "Agenda de hoje". */
export const getTodayAgenda = createServerFn({ method: "GET" }).handler(async () => {
  const now = new Date();
  return { today: localDay(now), entries: await todayEntries(getDb(), now) };
});
