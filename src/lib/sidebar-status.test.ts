import { describe, expect, it } from "vitest";
import { sidebarStatus, statusNeedsAction, type SidebarStatusInput } from "@/lib/sidebar-status";

function input(configured: boolean, systemAttention: boolean): SidebarStatusInput {
  return { mail: { configured }, systemAttention };
}

describe("sidebarStatus", () => {
  it("is loading before the first answer", () => {
    expect(sidebarStatus(undefined, false)).toBe("loading");
  });

  it("is unavailable when the status could not be read", () => {
    expect(sidebarStatus(undefined, true)).toBe("unavailable");
  });

  it("keeps the loaded data when a later refresh fails", () => {
    expect(sidebarStatus(input(true, false), true)).toBe("ok");
  });

  it("puts a missing mailbox before a failing task", () => {
    expect(sidebarStatus(input(false, true), false)).toBe("mail");
  });

  it("reports a failing task when the mailbox is set", () => {
    expect(sidebarStatus(input(true, true), false)).toBe("system");
  });

  it("is ok when nothing is wrong", () => {
    expect(sidebarStatus(input(true, false), false)).toBe("ok");
  });
});

describe("statusNeedsAction", () => {
  it("asks for action only for a real problem", () => {
    expect(statusNeedsAction("mail")).toBe(true);
    expect(statusNeedsAction("system")).toBe(true);
    expect(statusNeedsAction("ok")).toBe(false);
    expect(statusNeedsAction("loading")).toBe(false);
    expect(statusNeedsAction("unavailable")).toBe(false);
  });
});
