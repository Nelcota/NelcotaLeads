import { describe, expect, it } from "vitest";
import { pageTitle, withAttentionCount } from "./page-title";

describe("pageTitle", () => {
  it("names the page before the app", () => {
    expect(pageTitle("Conversas")).toBe("Conversas · Nelcota Leads");
  });
});

describe("withAttentionCount", () => {
  it.each([
    ["Conversas · Nelcota Leads", 3, "(3) Conversas · Nelcota Leads"],
    ["(3) Conversas · Nelcota Leads", 3, "(3) Conversas · Nelcota Leads"],
    ["(3) Conversas · Nelcota Leads", 12, "(12) Conversas · Nelcota Leads"],
    ["(3) Conversas · Nelcota Leads", 0, "Conversas · Nelcota Leads"],
    ["Leads · Nelcota Leads", 0, "Leads · Nelcota Leads"],
  ])("%s with %i → %s", (title, count, expected) => {
    expect(withAttentionCount(title, count)).toBe(expected);
  });
});
