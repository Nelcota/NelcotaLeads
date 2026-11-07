import { Avatar, GroupedRow, SectionHeader } from "@/components/apple-ui";
import { ownedLeadsLabel } from "@/lib/team";
import type { Team } from "@/server/team";

/** Everyone with an account: photo, name, e-mail and how many leads each one has taken. */
export function TeamMembers({ members }: { members: Team["members"] }) {
  return (
    <section className="enter min-w-0">
      <SectionHeader title="Pessoas" hint="Todos fazem tudo, com as mesmas permissões." />
      <div className="grouped">
        {members.map((member) => (
          <GroupedRow
            key={member.id}
            lead={<Avatar name={member.name} src={member.avatar} size={36} />}
            title={member.name}
            subtitle={member.email}
            trailing={
              <span className="shrink-0 text-[15px] text-muted-foreground tabular-nums">
                {ownedLeadsLabel(member.leads)}
              </span>
            }
          />
        ))}
      </div>
    </section>
  );
}
