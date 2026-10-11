import { createFileRoute, Link } from "@tanstack/react-router";
import { LeadDetail } from "@/components/lead-detail";
import { leadQuery } from "@/lib/queries";

export const Route = createFileRoute("/leads/$leadId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(leadQuery(params.leadId)),
  component: LeadPage,
});

function LeadPage() {
  const { leadId } = Route.useParams();
  return (
    <>
      <Link
        to="/"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        Leads
      </Link>
      <LeadDetail leadId={leadId} />
    </>
  );
}
