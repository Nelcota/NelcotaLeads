import Papa from "papaparse";
import { formatIsoLocal } from "./format";
import { whatsappLink } from "./phone";
import { LEAD_STATUS_LABELS } from "./schemas";

export type CsvLead = {
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  phoneE164: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  score: number | null;
  status: keyof typeof LEAD_STATUS_LABELS;
  notes: string;
  followUpOn?: string | null;
  createdAt: Date;
  summary: string | null;
  painPoints: string[] | null;
  firstMessage: string | null;
};

/**
 * CSV injection guard: string cells a spreadsheet could read as a formula get a leading `'`.
 * Papaparse's default misses whitespace before the trigger and `|`. No `m` flag, so only the
 * start of the cell counts, even in multi-line text.
 */
export const FORMULA_PATTERN = /^\s*[=+\-@\t\r\n|]/;

/** CSV for spreadsheet apps in pt-BR: `;` separator and a UTF-8 BOM so Excel reads accents. */
export function leadsToCsv(rows: CsvLead[]): string {
  const data = rows.map((lead) => ({
    nome: lead.name,
    cidade: lead.city ?? "",
    endereco: lead.address ?? "",
    telefone: lead.phone ?? "",
    telefone_e164: lead.phoneE164 ?? "",
    whatsapp: lead.phoneE164 ? whatsappLink(lead.phoneE164) : "",
    site: lead.website ?? "",
    // Decimal comma: Excel in pt-BR reads "4.7" as a date (4 de julho), not a rating.
    nota_google: lead.rating === null ? "" : String(lead.rating).replace(".", ","),
    avaliacoes: lead.reviewCount ?? "",
    nota_ia: lead.score ?? "",
    status: LEAD_STATUS_LABELS[lead.status],
    retornar_em: lead.followUpOn ?? "",
    resumo: lead.summary ?? "",
    dores: (lead.painPoints ?? []).join(" | "),
    mensagem: lead.firstMessage ?? "",
    notas: lead.notes,
    google_maps: lead.mapsUrl ?? "",
    criado_em: formatIsoLocal(lead.createdAt),
  }));
  return `﻿${Papa.unparse(data, {
    delimiter: ";",
    escapeFormulae: FORMULA_PATTERN,
    newline: "\r\n",
  })}`;
}
