import { describe, expect, it } from "vitest";
import { BOTTOM_SLACK, bottomScrollBehavior, isAtBottom } from "./thread-scroll";

describe("isAtBottom", () => {
  it("is true at the end and within the slack", () => {
    expect(isAtBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(
      isAtBottom({ scrollTop: 600 - BOTTOM_SLACK, scrollHeight: 1000, clientHeight: 400 }),
    ).toBe(true);
  });

  it("is false when the user scrolled up past the slack", () => {
    expect(
      isAtBottom({ scrollTop: 599 - BOTTOM_SLACK, scrollHeight: 1000, clientHeight: 400 }),
    ).toBe(false);
  });

  it("is true when everything fits", () => {
    expect(isAtBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 })).toBe(true);
  });
});

describe("bottomScrollBehavior", () => {
  it.each([
    [true, false, "auto"],
    [true, true, "auto"],
    [false, true, "auto"],
    [false, false, "smooth"],
  ] as const)("opening %s, reduced motion %s → %s", (opening, reduced, expected) => {
    expect(bottomScrollBehavior(opening, reduced)).toBe(expected);
  });
});
