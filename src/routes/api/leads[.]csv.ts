import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { getDb } from "@/db/client";
import { leadsToCsv } from "@/lib/csv";
import { leadFiltersSchema } from "@/lib/schemas";
import { queryLeads } from "@/server/leads-query";

export const Route = createFileRoute("/api/leads.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = Object.fromEntries(new URL(request.url).searchParams);
        const filters = leadFiltersSchema.safeParse(params);
        if (!filters.success) return new Response("Filtros inválidos", { status: 400 });
        const rows = await queryLeads(getDb(), filters.data);
        return new Response(leadsToCsv(rows), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="leads-${format(new Date(), "yyyy-MM-dd")}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
