import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/app-shell";
import { InviteForm } from "@/components/team/invite-form";
import { PendingInvites } from "@/components/team/pending-invites";
import { SignatureCard } from "@/components/team/signature-card";
import { TeamMembers } from "@/components/team/team-members";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeam } from "@/hooks/use-team";
import { pageTitle } from "@/lib/page-title";
import { teamQuery } from "@/lib/queries";

export const Route = createFileRoute("/equipe")({
  head: () => ({ meta: [{ title: pageTitle("Equipe") }] }),
  loader: ({ context }) => context.queryClient.prefetchQuery(teamQuery),
  component: TeamPage,
});

function TeamPage() {
  const team = useTeam();
  return (
    <Page title="Equipe" description="Quem trabalha nos leads. Todos têm as mesmas permissões.">
      <div className="mx-auto grid w-full max-w-2xl gap-8">
        <TeamBody team={team} />
      </div>
    </Page>
  );
}

function TeamBody({ team }: { team: ReturnType<typeof useTeam> }) {
  if (!team.data && team.failed) {
    return (
      <p className="text-sm text-red">Não foi possível carregar a equipe. Atualize a página.</p>
    );
  }
  if (!team.data) {
    return (
      <>
        <Skeleton className="h-40 rounded-[20px]" />
        <Skeleton className="h-28 rounded-[20px]" />
      </>
    );
  }
  return (
    <>
      <TeamMembers members={team.data.members} />
      <PendingInvites
        invites={team.data.invites}
        emailsEnabled={team.data.inviteEmailsEnabled}
        removingId={team.removingId}
        onRemove={team.removeInvite}
      />
      <InviteForm
        email={team.email}
        error={team.error}
        inviting={team.inviting}
        emailsEnabled={team.data.inviteEmailsEnabled}
        onEmailChange={team.changeEmail}
        onSubmit={team.submitInvite}
        onCopyLink={team.copyLink}
      />
      <SignatureCard />
    </>
  );
}
