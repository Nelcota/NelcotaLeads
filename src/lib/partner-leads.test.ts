import { describe, expect, it } from "vitest";
import { leadsInProgress } from "./partner-leads";

const today = "2026-11-12";

describe("leads in progress", () => {
  it("keeps contacted and replied leads, the most urgent first", () => {
    const rows = [
      { id: "new", status: "new", followUpOn: null },
      { id: "talking", status: "replied", followUpOn: null },
      { id: "waiting", status: "contacted", followUpOn: null },
      { id: "due", status: "contacted", followUpOn: "2026-11-12" },
      { id: "late", status: "contacted", followUpOn: "2026-11-10" },
      { id: "closed", status: "closed", followUpOn: null },
      { id: "later", status: "replied", followUpOn: "2026-11-20" },
    ];
    expect(leadsInProgress(rows, today, 10).map((lead) => lead.id)).toEqual([
      "late",
      "due",
      "talking",
      "later",
      "waiting",
    ]);
  });

  it("shows only the first few", () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      status: "contacted",
      followUpOn: null,
    }));
    expect(leadsInProgress(rows, today, 5)).toHaveLength(5);
  });
});
