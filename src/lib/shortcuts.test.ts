import { describe, expect, it } from "vitest";
import { isSendChord, sendShortcut, SHORTCUTS } from "./shortcuts";

describe("sendShortcut", () => {
  it("shows ⌘↵ on Apple systems and Ctrl+Enter elsewhere", () => {
    expect(sendShortcut(true)).toBe("⌘↵");
    expect(sendShortcut(false)).toBe("Ctrl+Enter");
  });
});

describe("isSendChord", () => {
  it.each([
    [{ key: "Enter", metaKey: true, ctrlKey: false }, true],
    [{ key: "Enter", metaKey: false, ctrlKey: true }, true],
    [{ key: "Enter", metaKey: false, ctrlKey: false }, false],
    [{ key: "j", metaKey: false, ctrlKey: true }, false],
  ])("%o → %s", (event, expected) => {
    expect(isSendChord(event)).toBe(expected);
  });
});

describe("SHORTCUTS", () => {
  it("lists J, K, Esc, the send chord and the Leads keys once each", () => {
    expect(SHORTCUTS.map((item) => item.keys.join("+"))).toEqual([
      "J",
      "K",
      "Esc",
      "Mod+Enter",
      "/",
      "X",
      "E",
      "W",
    ]);
  });
});
