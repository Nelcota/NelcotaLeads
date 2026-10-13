import { createFileRoute, redirect } from "@tanstack/react-router";
import { idSchema } from "@/lib/schemas";
import { searchExists } from "@/server/searches";

// A search is just a filter on the inbox; a missing one goes back to Buscas and says so.
export const Route = createFileRoute("/searches/$searchId")({
  beforeLoad: async ({ params }) => {
    const id = params.searchId;
    const found = idSchema.safeParse(id).success && (await searchExists({ data: { id } }));
    throw found
      ? redirect({ to: "/leads", search: { view: "all", searchId: id } })
      : redirect({ to: "/searches", search: { missing: true } });
  },
});
