import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/db/client";
import { leadsToCsv } from "@/lib/csv";
import { localDay } from "@/lib/format";
import { leadFiltersSchema } from "@/lib/schemas";
import { EXPORT_LIMIT, queryLeadsCapped } from "@/server/leads-query";

export const Route = createFileRoute("/api/leads.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = Object.fromEntries(new URL(request.url).searchParams);
        const filters = leadFiltersSchema.safeParse(params);
        if (!filters.success) return new Response("Filtros inválidos", { status: 400 });
        const { rows, truncated } = await queryLeadsCapped(getDb(), filters.data, EXPORT_LIMIT);
        const headers = new Headers({
          "Content-Type": "text/csv; charset=utf-8",
          // The Worker runs in UTC; name the file after the user's local day.
          "Content-Disposition": `attachment; filename="leads-${localDay(new Date())}.csv"`,
          "Cache-Control": "no-store",
        });
        // More leads matched than one export holds; narrow the filters to get the rest.
        if (truncated) headers.set("X-Truncated", "true");
        return new Response(leadsToCsv(rows), { headers });
      },
    },
  },
});
