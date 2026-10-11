import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { leadsToCsv, type CsvLead } from "./csv";

const lead: CsvLead = {
  name: 'Clínica "Sorriso"; BH',
  city: "Belo Horizonte",
  address: null,
  phone: "(31) 99876-5432",
  phoneE164: "+5531998765432",
  website: null,
  rating: 4.5,
  reviewCount: 12,
  mapsUrl: null,
  score: 70,
  status: "contacted",
  notes: '=HYPERLINK("x")',
  createdAt: new Date("2026-10-11T17:30:00Z"),
  summary: "Resumo",
  painPoints: ["Sem site", "Poucas avaliações"],
  firstMessage: "Olá!\nTudo bem?",
};

describe("leadsToCsv", () => {
  it("produces a BOM-prefixed, semicolon-separated CSV that round-trips", () => {
    const csv = leadsToCsv([lead]);
    expect(csv.startsWith("﻿")).toBe(true);
    const parsed = Papa.parse<Record<string, string>>(csv.slice(1), {
      header: true,
      delimiter: ";",
    });
    const row = parsed.data[0];
    expect(row?.nome).toBe('Clínica "Sorriso"; BH');
    expect(row?.whatsapp).toBe("https://wa.me/5531998765432");
    expect(row?.status).toBe("Contatado");
    expect(row?.dores).toBe("Sem site | Poucas avaliações");
    expect(row?.mensagem).toBe("Olá!\nTudo bem?");
    expect(row?.criado_em).toBe("2026-10-11 14:30");
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(leadsToCsv([lead])).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
