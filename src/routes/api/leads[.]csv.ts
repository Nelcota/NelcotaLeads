import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDb } from "@/db/client";
import { leadsToCsv } from "@/lib/csv";
import { localDay } from "@/lib/format";
import { idSchema, LEAD_VIEW_LABELS, leadFiltersSchema } from "@/lib/schemas";
import { EXPORT_LIMIT, queryLeadsCapped, type LeadQuery } from "@/server/leads-query";
import { requestUserId } from "@/server/request-user";

/** Most leads "Exportar seleção" sends at once. */
const SELECTION_LIMIT = 1000;

// Comma-separated lead ids, posted by a form (a long selection doesn't fit in a URL).
const selectionSchema = z.object({
  ids: z
    .string()
    .max(SELECTION_LIMIT * 65)
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(idSchema).min(1).max(SELECTION_LIMIT)),
});

/** "A contatar" → "a-contatar": the file name says which tab was exported. */
function fileSlug(query: LeadQuery): string {
  if (query.ids) return "selecionados";
  const label = query.view ? LEAD_VIEW_LABELS[query.view] : LEAD_VIEW_LABELS.all;
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function csvResponse(query: LeadQuery) {
  const { rows, truncated } = await queryLeadsCapped(getDb(), query, EXPORT_LIMIT);
  const headers = new Headers({
    "Content-Type": "text/csv; charset=utf-8",
    // The Worker runs in UTC; name the file after the user's local day.
    "Content-Disposition": `attachment; filename="leads-${fileSlug(query)}-${localDay(new Date())}.csv"`,
    "Cache-Control": "no-store",
  });
  // More leads matched than one export holds; narrow the filters to get the rest.
  if (truncated) headers.set("X-Truncated", "true");
  return new Response(leadsToCsv(rows), { headers });
}

export const Route = createFileRoute("/api/leads.csv")({
  server: {
    handlers: {
      // "Exportar CSV": the leads matching the list filters.
      GET: async ({ request }) => {
        const params = Object.fromEntries(new URL(request.url).searchParams);
        const filters = leadFiltersSchema.safeParse(params);
        if (!filters.success) return new Response("Filtros inválidos", { status: 400 });
        const ownerId = filters.data.mine ? await requestUserId() : null;
        return csvResponse({ ...filters.data, ownerId });
      },
      // "Exportar seleção": the selected leads, whatever the filters.
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const selection = selectionSchema.safeParse({ ids: form?.get("ids") });
        if (!selection.success) return new Response("Seleção inválida", { status: 400 });
        return csvResponse({ ids: selection.data.ids });
      },
    },
  },
});
