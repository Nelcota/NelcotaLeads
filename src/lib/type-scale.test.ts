import { describe, expect, it } from "vitest";
import { nearestTypeSize } from "./type-scale";

describe("nearestTypeSize", () => {
  it("keeps a size that is already on the scale", () => {
    expect(nearestTypeSize(16)).toBe(16);
  });

  it("snaps a computed size to the closest scale size", () => {
    expect(nearestTypeSize(11)).toBe(12);
    expect(nearestTypeSize(15.4)).toBe(16);
    expect(nearestTypeSize(20)).toBe(18);
  });

  it("falls back to the smallest size for a value that is not a number", () => {
    expect(nearestTypeSize(Number.NaN)).toBe(12);
  });
});
