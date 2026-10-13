import { createFileRoute, redirect } from "@tanstack/react-router";
import { idSchema } from "@/lib/schemas";
import { leadExists } from "@/server/leads";

// Old full-page lead URLs open the lead inside the inbox; a missing one says so there.
export const Route = createFileRoute("/leads/$leadId")({
  beforeLoad: async ({ params }) => {
    const id = params.leadId;
    const found = idSchema.safeParse(id).success && (await leadExists({ data: { id } }));
    throw redirect({
      to: "/leads",
      search: found ? { view: "all", lead: id } : { view: "all", missing: true },
    });
  },
});
