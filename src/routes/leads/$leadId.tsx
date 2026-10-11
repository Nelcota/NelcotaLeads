import { createFileRoute, redirect } from "@tanstack/react-router";

// Old full-page lead URLs open the lead inside the inbox.
export const Route = createFileRoute("/leads/$leadId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/", search: { view: "all", lead: params.leadId } });
  },
});
