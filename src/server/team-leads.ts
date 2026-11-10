import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { assignLeadsSchema } from "@/lib/schemas";
import { splitEvenly } from "@/lib/team-split";
import { assignLeads } from "./lead-assign-store";
import { requestUserId } from "./request-user";
import { freeLeadIds } from "./team-free-store";
import { heldByOwner } from "./team-stats-store";
import { teamMemberIds } from "./team-store";

/** "Entregar a" and "Desfazer": moves the given leads, each only if its owner did not change. */
export const assignTeamLeads = createServerFn({ method: "POST" })
  .validator(assignLeadsSchema)
  .handler(async ({ data }) => {
    const moved = await assignLeads(getDb(), data.assignments, await requestUserId(), new Date());
    return { moved };
  });

/**
 * "Dividir igualmente": every free lead, dealt around the team from whoever holds fewest. Read
 * on the server at the moment of the click, so a lead taken meanwhile is left alone.
 */
export const splitFreeLeads = createServerFn({ method: "POST" }).handler(async () => {
  const db = getDb();
  const [ids, members, held] = await Promise.all([
    freeLeadIds(db),
    teamMemberIds(db),
    heldByOwner(db),
  ]);
  const loads = members.map((id) => ({ id, held: held.get(id)?.held ?? 0 }));
  const assignments = splitEvenly(ids, loads);
  if (assignments.length === 0) return { moved: [] };
  const moved = await assignLeads(db, assignments, await requestUserId(), new Date());
  return { moved };
});
