import { describe, expect, it } from "vitest";
import { replyBlock } from "./metric-blocks";

const stats = { aiTalking: 2, interested: 1 };

describe("replyBlock", () => {
  it("says the rate is of the leads contacted in the period", () => {
    const block = replyBlock(stats, { contacted: 25, replied: 3 });
    expect(block.big).toBe("12%");
    expect(block.caption).toBe("dos contatados no período responderam");
    expect(block.empty).toBeUndefined();
    expect(block.rows.map((row) => [row.label, row.value])).toEqual([
      ["Responderam", "3 de 25"],
      ["IA conversando agora", 2],
      ["Precisam de você agora", 1],
    ]);
  });

  it("says nobody was contacted instead of a dash and zero rows", () => {
    const block = replyBlock(stats, { contacted: 0, replied: 0 });
    expect(block.empty).toBe("Ninguém contatado no período");
    expect(block.rows.map((row) => row.label)).toEqual([
      "IA conversando agora",
      "Precisam de você agora",
    ]);
  });
});
