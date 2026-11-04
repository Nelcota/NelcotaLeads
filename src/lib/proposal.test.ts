import { describe, expect, it } from "vitest";
import {
  buildProposalItems,
  customLinesFromForm,
  previewItems,
  proposalInputSchema,
  proposalStatusLine,
  proposalTotals,
  wonPrefill,
} from "./proposal";

const site = { id: "s1", name: "Site institucional", priceCents: 99_000, monthly: false };
const domain = {
  id: "a1",
  name: "Domínio e e-mail profissional",
  priceCents: 19_000,
  monthly: false,
};
const upkeep = { id: "a2", name: "Manutenção mensal", priceCents: 12_000, monthly: true };

describe("proposal lines", () => {
  it("puts the service first, then add-ons, then the client's requests", () => {
    const items = buildProposalItems(
      site,
      [domain, upkeep],
      [{ label: "Galeria de fotos", priceCents: 20_000 }],
    );
    expect(items).toEqual([
      { kind: "service", label: "Site institucional", priceCents: 99_000, monthly: false },
      { kind: "addon", label: "Domínio e e-mail profissional", priceCents: 19_000, monthly: false },
      { kind: "addon", label: "Manutenção mensal", priceCents: 12_000, monthly: true },
      { kind: "custom", label: "Galeria de fotos", priceCents: 20_000, monthly: false },
    ]);
    expect(proposalTotals(items)).toEqual({ totalCents: 150_000, monthlyCents: 12_000 });
  });

  it("previews only once a service is picked and skips unfinished requests", () => {
    const table = { services: [site], addons: [domain, upkeep] };
    expect(previewItems(table, { serviceId: null, addonIds: [], lines: [] })).toBeNull();
    const items = previewItems(table, {
      serviceId: "s1",
      addonIds: ["a1"],
      lines: [
        { key: "1", label: "Galeria", price: "200" },
        { key: "2", label: "", price: "100" },
        { key: "3", label: "Blog", price: "abc" },
      ],
    });
    expect(items?.map((item) => item.label)).toEqual([
      "Site institucional",
      "Domínio e e-mail profissional",
      "Galeria",
    ]);
  });

  it("checks the client's requests before saving", () => {
    expect(customLinesFromForm([{ key: "1", label: "Galeria", price: "1.200,50" }])).toEqual({
      ok: true,
      value: [{ label: "Galeria", priceCents: 120_050 }],
    });
    expect(customLinesFromForm([{ key: "1", label: "Galeria", price: "0" }]).ok).toBe(false);
    expect(customLinesFromForm([{ key: "1", label: " ", price: "10" }]).ok).toBe(false);
  });

  it("rejects requests without a label or a positive value on the server", () => {
    const base = { leadId: "l", serviceId: "s1", addonIds: [], sendEmail: false };
    expect(proposalInputSchema.safeParse({ ...base, custom: [] }).success).toBe(true);
    expect(
      proposalInputSchema.safeParse({ ...base, custom: [{ label: "x", priceCents: 0 }] }).success,
    ).toBe(false);
    expect(
      proposalInputSchema.safeParse({ ...base, custom: [{ label: "", priceCents: 10 }] }).success,
    ).toBe(false);
  });

  it("starts Fechar negócio from the proposal's total and service", () => {
    const items = buildProposalItems(site, [domain], []);
    expect(wonPrefill({ items, totalCents: 118_000 })).toEqual({
      value: "1.180,00",
      service: "Site institucional",
    });
    expect(wonPrefill(null)).toBeNull();
  });
});

const line = (emailStatus: Parameters<typeof proposalStatusLine>[0]["emailStatus"]) =>
  proposalStatusLine({ totalCents: 149_000, emailStatus });

describe("proposal status", () => {
  it("reads the e-mail's own status, never claiming sent while it waits", () => {
    expect(line("queued")).toMatch(/· na fila de envio$/);
    expect(line("sent")).toMatch(/· enviada por e-mail$/);
    expect(line("failed")).toMatch(/· o e-mail falhou$/);
    expect(line(null)).toMatch(/· não foi por e-mail$/);
    expect(line("queued")).toContain("Última proposta: R$");
  });
});
