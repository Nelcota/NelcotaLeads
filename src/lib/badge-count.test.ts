import { describe, expect, it } from "vitest";
import { badgeCount } from "@/lib/badge-count";

describe("badgeCount", () => {
  it("shows small counts in full", () => {
    expect(badgeCount(1)).toBe("1");
    expect(badgeCount(99)).toBe("99");
  });

  it("caps counts above 99", () => {
    expect(badgeCount(100)).toBe("99+");
    expect(badgeCount(12_345)).toBe("99+");
  });
});
