import type { LeadAssignment } from "./schemas";

/** A partner and how many leads they hold now. */
export type MemberLoad = { id: string; held: number };

/** Who starts receiving: fewest leads in hand first; ties keep the team's order. */
function byLoad(members: readonly MemberLoad[]): MemberLoad[] {
  return members
    .map((member, index) => ({ member, index }))
    .toSorted((a, b) => a.member.held - b.member.held || a.index - b.index)
    .map((entry) => entry.member);
}

/**
 * "Dividir igualmente": deals the free leads one by one around the team, starting with whoever
 * holds fewest, so counts differ by one at most (7 leads, 3 partners: 3, 2, 2).
 */
export function splitEvenly(
  leadIds: readonly string[],
  members: readonly MemberLoad[],
): LeadAssignment[] {
  const order = byLoad(members);
  if (order.length === 0) return [];
  return leadIds.flatMap((id, index) => {
    const target = order[index % order.length];
    return target ? [{ id, owner: target.id, expected: null }] : [];
  });
}

export type SplitShare = { id: string; count: number; after: number };

/** What "Dividir igualmente" will do, for its confirmation: each partner's share, most first. */
export function splitPreview(freeCount: number, members: readonly MemberLoad[]): SplitShare[] {
  const order = byLoad(members);
  if (order.length === 0 || freeCount <= 0) return [];
  const base = Math.floor(freeCount / order.length);
  const extra = freeCount % order.length;
  return order
    .map((member, index) => {
      const count = base + (index < extra ? 1 : 0);
      return { id: member.id, count, after: member.held + count };
    })
    .filter((share) => share.count > 0);
}

/** "Desfazer": puts each moved lead back with nobody, if it is still with whom it went to. */
export function undoAssignments(moved: readonly LeadAssignment[]): LeadAssignment[] {
  return moved.flatMap((item) =>
    item.owner ? [{ id: item.id, owner: item.expected, expected: item.owner }] : [],
  );
}
