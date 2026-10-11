import type { Lead } from "@/db/schema";
import { addDays } from "@/lib/format";
import type { UpdateLeadInput } from "@/lib/schemas";

export const DEFAULT_FOLLOW_UP_DAYS = 3;

type Patch = Partial<Pick<Lead, "status" | "notes" | "contactedAt" | "followUpOn">>;

/**
 * Turns a lead update into the columns to write. Marking a lead as contacted records
 * when it happened and schedules a follow-up; leaving the pipeline clears the follow-up.
 */
export function leadPatch(
  current: Pick<Lead, "contactedAt" | "followUpOn">,
  { id: _id, ...changes }: UpdateLeadInput,
  now: Date,
  today: string,
): Patch {
  const patch: Patch = { ...changes };
  if (changes.status === "contacted") {
    patch.contactedAt = current.contactedAt ?? now;
    if (changes.followUpOn === undefined && !current.followUpOn) {
      patch.followUpOn = addDays(today, DEFAULT_FOLLOW_UP_DAYS);
    }
  }
  if (
    (changes.status === "new" || changes.status === "closed" || changes.status === "discarded") &&
    changes.followUpOn === undefined
  ) {
    patch.followUpOn = null;
  }
  return patch;
}
