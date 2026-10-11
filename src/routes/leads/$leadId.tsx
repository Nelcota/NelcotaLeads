import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
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
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Leads
      </Link>
      <LeadDetail leadId={leadId} />
    </>
  );
}
