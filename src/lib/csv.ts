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
    nota_google: lead.rating ?? "",
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
  // escapeFormulae guards against CSV injection (cells starting with =, +, -, @).
  return `﻿${Papa.unparse(data, { delimiter: ";", escapeFormulae: true, newline: "\r\n" })}`;
}
