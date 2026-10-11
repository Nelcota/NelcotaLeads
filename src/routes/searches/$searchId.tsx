import { createFileRoute, redirect } from "@tanstack/react-router";

// A search is just a filter on the inbox.
export const Route = createFileRoute("/searches/$searchId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/", search: { view: "all", searchId: params.searchId } });
  },
});
