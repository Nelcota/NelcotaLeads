import { PlusIcon } from "@/components/icons";
import { Avatar } from "@/components/apple-ui";
import type { Team, TeamMember } from "@/server/team";
import { InvitePanel } from "./invite-panel";

/** An empty seat next to your avatar: "someone goes here". */
function EmptySeat() {
  return (
    <span className="-ml-3 grid size-[52px] place-items-center rounded-full border-[1.5px] border-dashed border-border bg-card text-tertiary">
      <PlusIcon className="size-5" />
    </span>
  );
}

/** Alone on the team: "Convide os sócios" leads the page, with the form always open. */
export function SoloInviteCard({
  member,
  invites,
  emailsEnabled,
  today,
}: {
  member: TeamMember;
  invites: Team["invites"];
  emailsEnabled: boolean;
  today: string;
}) {
  return (
    <section className="grouped enter p-5 sm:p-6" aria-labelledby="team-solo-invite">
      <div className="flex items-start gap-4">
        <div aria-hidden className="flex shrink-0">
          <Avatar neutral name={member.name} src={member.avatar} size={52} />
          <EmptySeat />
          <EmptySeat />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id="team-solo-invite" className="text-[22px] font-semibold tracking-[-0.015em]">
            Convide os sócios
          </h2>
          <p className="text-base text-muted-foreground">Cada sócio entra com o próprio e-mail.</p>
        </div>
      </div>
      <InvitePanel invites={invites} emailsEnabled={emailsEnabled} today={today} showEmptyPending />
    </section>
  );
}
