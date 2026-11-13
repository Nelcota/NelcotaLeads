import type { Team } from "@/server/team";
import { InvitePanel } from "./invite-panel";
import { PhoneFold } from "./phone-fold";

/** The phone's closed line: "1 convite pendente" or "Convidar um sócio". */
function invitesSummary(pending: number): string {
  if (pending === 0) return "Convidar um sócio";
  return `${pending} ${pending === 1 ? "convite pendente" : "convites pendentes"}`;
}

/** "Convites": invite by e-mail and the pending ones, each with its link. */
export function InvitesCard({
  invites,
  emailsEnabled,
  today,
}: {
  invites: Team["invites"];
  emailsEnabled: boolean;
  today: string;
}) {
  return (
    <section
      className="grouped enter p-5 sm:p-6"
      style={{ animationDelay: "180ms" }}
      aria-labelledby="team-invites"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
        <h2 id="team-invites" className="text-[20px] font-semibold tracking-[-0.015em]">
          Convites
        </h2>
        <span className="text-sm text-tertiary">
          {invites.length} {invites.length === 1 ? "pendente" : "pendentes"}
        </span>
      </div>
      <PhoneFold summary={invitesSummary(invites.length)}>
        <InvitePanel invites={invites} emailsEnabled={emailsEnabled} today={today} />
      </PhoneFold>
    </section>
  );
}
