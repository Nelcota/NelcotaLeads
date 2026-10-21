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
    // pt-BR spreadsheets read "4.5" as a date; whole numbers stay as they are.
    expect(row?.nota_google).toBe("4,5");
    expect(row?.avaliacoes).toBe("12");
  });

  it("writes whole and missing ratings", () => {
    const rows = Papa.parse<Record<string, string>>(
      leadsToCsv([
        { ...lead, rating: 5 },
        { ...lead, rating: null },
      ]).slice(1),
      { header: true, delimiter: ";" },
    ).data;
    expect(rows.map((row) => row.nota_google)).toEqual(["5", ""]);
  });

  it("neutralizes spreadsheet formulas", () => {
    expect(leadsToCsv([lead])).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it.each([
    "=1+1\nx",
    ' =HYPERLINK("http://x")',
    "\t=1",
    "\r=1",
    "\n=1",
    "|cmd",
    "+1",
    "-1",
    "@SUM(A1)",
  ])("prefixes formula-like cell %j with a quote", (notes) => {
    const csv = leadsToCsv([{ ...lead, notes }]);
    const row = Papa.parse<Record<string, string>>(csv.slice(1), { header: true, delimiter: ";" })
      .data[0];
    expect(row?.notas).toBe(`'${notes}`);
  });

  it("leaves ordinary text alone, including formulas after the first line", () => {
    const csv = leadsToCsv([{ ...lead, notes: "Ligar amanhã\n=1+1" }]);
    const row = Papa.parse<Record<string, string>>(csv.slice(1), { header: true, delimiter: ";" })
      .data[0];
    expect(row?.notas).toBe("Ligar amanhã\n=1+1");
  });
});
