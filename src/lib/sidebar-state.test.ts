import { describe, expect, it } from "vitest";
import { cookieValue, SIDEBAR_COOKIE, sidebarOpenFrom } from "./sidebar-state";

describe("sidebar state", () => {
  it("reads the sidebar cookie among others", () => {
    expect(cookieValue(`theme=dark; ${SIDEBAR_COOKIE}=false; x=1`, SIDEBAR_COOKIE)).toBe("false");
    expect(cookieValue("theme=dark", SIDEBAR_COOKIE)).toBeUndefined();
  });

  it("keeps the menu open unless it was collapsed", () => {
    expect(sidebarOpenFrom("false")).toBe(false);
    expect(sidebarOpenFrom("true")).toBe(true);
    expect(sidebarOpenFrom(undefined)).toBe(true);
  });
});
