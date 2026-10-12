import { describe, expect, it } from "vitest";
import { stepValue } from "./step";

const SCORE = { min: 0, max: 100, step: 5 };
const WEIGHT = { min: -100, max: 100, step: 5 };

describe("stepValue", () => {
  it.each([
    [30, 1, 35],
    [30, -1, 25],
    [12, 1, 15],
    [12, -1, 10],
    [98, 1, 100],
    [100, 1, 100],
    [2, -1, 0],
    [0, -1, 0],
  ] as const)("score %i, direction %i → %i", (current, direction, expected) => {
    expect(stepValue(current, direction, SCORE)).toBe(expected);
  });

  it("goes below zero when the range allows it", () => {
    expect(stepValue(0, -1, WEIGHT)).toBe(-5);
    expect(stepValue(-12, -1, WEIGHT)).toBe(-15);
    expect(stepValue(-12, 1, WEIGHT)).toBe(-10);
    expect(stepValue(-100, -1, WEIGHT)).toBe(-100);
  });

  it("starts an empty field from zero", () => {
    expect(stepValue(Number.NaN, 1, SCORE)).toBe(5);
    expect(stepValue(Number.NaN, -1, SCORE)).toBe(0);
  });

  it("brings an out-of-range value back inside", () => {
    expect(stepValue(150, -1, SCORE)).toBe(100);
    expect(stepValue(-20, 1, SCORE)).toBe(0);
  });
});
