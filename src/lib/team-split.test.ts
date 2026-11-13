import { describe, expect, it } from "vitest";
import { splitEvenly, splitPreview, undoAssignments } from "./team-split";

const team = [
  { id: "haniel", held: 18 },
  { id: "phellipe", held: 14 },
  { id: "guilherme", held: 11 },
];

describe("Dividir igualmente", () => {
  it("deals by count, starting with whoever holds fewest", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const owners = splitEvenly(ids, team).map((item) => item.owner);
    expect(owners).toEqual([
      "guilherme",
      "phellipe",
      "haniel",
      "guilherme",
      "phellipe",
      "haniel",
      "guilherme",
    ]);
    expect(splitEvenly(ids, team).every((item) => item.expected === null)).toBe(true);
  });

  it("previews the same shares the split makes, most first", () => {
    expect(splitPreview(7, team)).toEqual([
      { id: "guilherme", count: 3, after: 14 },
      { id: "phellipe", count: 2, after: 16 },
      { id: "haniel", count: 2, after: 20 },
    ]);
    expect(splitPreview(1, team)).toEqual([{ id: "guilherme", count: 1, after: 12 }]);
  });

  it("keeps the team's order on ties and handles empty inputs", () => {
    const tied = [
      { id: "a", held: 0 },
      { id: "b", held: 0 },
    ];
    expect(splitEvenly(["x"], tied)[0]?.owner).toBe("a");
    expect(splitEvenly(["x"], [])).toEqual([]);
    expect(splitPreview(0, team)).toEqual([]);
  });

  it("undoes only what moved, back to nobody", () => {
    expect(undoAssignments([{ id: "a", owner: "haniel", expected: null }])).toEqual([
      { id: "a", owner: null, expected: "haniel" },
    ]);
  });
});
