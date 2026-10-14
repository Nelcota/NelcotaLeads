import { describe, expect, it } from "vitest";
import { splitQuoted } from "./quoted";

const ORIGINAL = "Olá, tudo bem? Texto para Clínica Sorriso.";

describe("splitQuoted", () => {
  it.each([
    [
      "Gmail pt",
      `Pode sim, me liga amanhã.\n\nEm seg., 12 de out. de 2026 às 10:00, Ana Teste <eu@nelcota.test> escreveu:\n\n> ${ORIGINAL}`,
      "Pode sim, me liga amanhã.",
    ],
    [
      "Gmail pt, attribution wrapped over two lines",
      `Pode sim.\n\nEm seg., 12 de out. de 2026 às 10:00, Ana Teste <\neu@nelcota.test> escreveu:\n\n> ${ORIGINAL}`,
      "Pode sim.",
    ],
    [
      "Gmail en",
      `Sounds good.\n\nOn Mon, Oct 12, 2026 at 10:00 AM Ana Teste <eu@nelcota.test> wrote:\n> ${ORIGINAL}`,
      "Sounds good.",
    ],
    [
      "Apple Mail pt",
      `Tenho interesse.\n\nEm 12 de out. de 2026, à(s) 10:00, Ana Teste <eu@nelcota.test> escreveu:\n\n> ${ORIGINAL}\n>`,
      "Tenho interesse.",
    ],
    [
      "Outlook pt",
      `Obrigado, vou ver.\n\n________________________________\nDe: Ana Teste <eu@nelcota.test>\nEnviado: segunda-feira, 12 de outubro de 2026 10:00\nPara: contato@sorriso.test\nAssunto: Olá\n\n${ORIGINAL}`,
      "Obrigado, vou ver.",
    ],
    [
      "Outlook en",
      `Thanks.\n\nFrom: Ana Teste <eu@nelcota.test>\nSent: Monday, October 12, 2026 10:00 AM\nTo: contato@sorriso.test\n\n${ORIGINAL}`,
      "Thanks.",
    ],
    [
      "Original Message",
      `Pode ser.\n\n-----Original Message-----\nFrom: eu@nelcota.test\n${ORIGINAL}`,
      "Pode ser.",
    ],
    [
      "Mensagem original",
      `Pode ser.\n\n-----Mensagem original-----\nDe: eu@nelcota.test\n${ORIGINAL}`,
      "Pode ser.",
    ],
    ["final > block", `Quanto custa?\n\n> ${ORIGINAL}\n>\n> Ana Teste`, "Quanto custa?"],
  ])("%s: keeps only the new text", (_name, body, visible) => {
    const result = splitQuoted(body);
    expect(result.visible).toBe(visible);
    expect(result.quoted).toContain(ORIGINAL);
  });

  it("leaves a message without a quote alone", () => {
    const body = "Oi! Pode me contar mais sobre isso?\n\nAbraço,\nJoão";
    expect(splitQuoted(body)).toEqual({ visible: body, quoted: null });
  });

  it("never hides everything: a body that is only a quote shows whole", () => {
    const body = `> ${ORIGINAL}\n> Ana Teste`;
    expect(splitQuoted(body)).toEqual({ visible: body, quoted: null });
    const attributionOnly = `Em 12 de out. de 2026, Ana <eu@nelcota.test> escreveu:\n> ${ORIGINAL}`;
    expect(splitQuoted(attributionOnly)).toEqual({ visible: attributionOnly, quoted: null });
  });

  it("keeps a > line in the middle and an undated 'escreveu:' as text", () => {
    const middle = "Veja:\n> isso aqui\nO que acha?";
    expect(splitQuoted(middle).quoted).toBeNull();
    const prose = "Em resumo, o cliente escreveu:\nque quer um site novo.";
    expect(splitQuoted(prose).quoted).toBeNull();
  });

  it("does not take a 'De:' line without an Outlook header for a quote", () => {
    const body = "Horário de atendimento\nDe: segunda a sexta\nAté: 18h";
    expect(splitQuoted(body).quoted).toBeNull();
  });
});
