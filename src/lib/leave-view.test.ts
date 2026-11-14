import { describe, expect, it } from "vitest";
import { leavesView } from "./leave-view";

describe("leavesView", () => {
  it("leaves on another path", () => {
    expect(
      leavesView({ pathname: "/settings", search: {} }, { pathname: "/conta", search: {} }),
    ).toBe(true);
  });

  it("leaves on another tab of the same page", () => {
    expect(
      leavesView(
        { pathname: "/settings", search: { aba: "ia" } },
        { pathname: "/settings", search: { aba: "automacao" } },
      ),
    ).toBe(true);
  });

  it("stays when only the hash changes", () => {
    expect(
      leavesView(
        { pathname: "/settings", search: { aba: "ia" } },
        { pathname: "/settings", search: { aba: "ia" } },
      ),
    ).toBe(false);
    expect(
      leavesView({ pathname: "/conta", search: undefined }, { pathname: "/conta", search: {} }),
    ).toBe(false);
  });
});
