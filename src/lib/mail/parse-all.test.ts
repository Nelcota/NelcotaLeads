import { describe, expect, it, vi } from "vitest";
import { parseAll } from "./index";

// The real parser reads the header block fine but fails on the cut-off body.
vi.mock("./parse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./parse")>();
  return {
    ...actual,
    parseEmail: async (raw: Uint8Array) => {
      if (new TextDecoder().decode(raw).includes("--cut")) throw new Error("broken MIME");
      return actual.parseEmail(raw);
    },
  };
});

describe("parseAll", () => {
  it("keeps a truncated message that fails to parse, from its headers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = new TextEncoder().encode(
      "From: lead@clinica.com.br\r\nSubject: Re: Proposta\r\n\r\n--cut\r\nContent-Type: image/png\r\n\r\niVBOR",
    );
    const messages = await parseAll([
      { uid: 1, raw, truncated: true },
      { uid: 2, raw, truncated: false },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      from: "lead@clinica.com.br",
      subject: "Re: Proposta",
      text: "",
      truncated: true,
    });
    warn.mockRestore();
  });
});
