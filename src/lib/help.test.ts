import { describe, expect, it } from "vitest";
import { GLOSSARY, HELP_SHORTCUTS, HOW_IT_WORKS, isHelpKey, keyLabel } from "./help";
import { SHORTCUTS } from "./shortcuts";

describe("help content", () => {
  it("has the five steps and the concepts the InfoTips explain", () => {
    expect(HOW_IT_WORKS).toHaveLength(5);
    expect(Object.keys(GLOSSARY)).toEqual([
      "score",
      "minScore",
      "autopilot",
      "needsYou",
      "aiInCharge",
      "dailyLimit",
      "optOut",
    ]);
    for (const entry of Object.values(GLOSSARY)) expect(entry.text).toMatch(/^[A-ZÀ-Ý"].*\.$/);
  });

  it("lists the app's shortcuts and the help's own", () => {
    expect(HELP_SHORTCUTS.slice(0, SHORTCUTS.length)).toEqual([...SHORTCUTS]);
    expect(HELP_SHORTCUTS.at(-1)?.keys).toEqual(["?"]);
  });
});

describe("keyLabel", () => {
  it.each([
    ["Mod", true, "⌘"],
    ["Mod", false, "Ctrl"],
    ["Enter", true, "↵"],
    ["Enter", false, "Enter"],
    ["J", false, "J"],
  ])("%s (apple: %s) → %s", (key, apple, expected) => {
    expect(keyLabel(key, apple)).toBe(expected);
  });
});

describe("isHelpKey", () => {
  const base = { metaKey: false, ctrlKey: false, altKey: false };
  it.each([
    [{ ...base, key: "?" }, true],
    [{ ...base, key: "/" }, false],
    [{ ...base, key: "?", ctrlKey: true }, false],
    [{ ...base, key: "?", metaKey: true }, false],
  ])("%o → %s", (event, expected) => {
    expect(isHelpKey(event)).toBe(expected);
  });
});
