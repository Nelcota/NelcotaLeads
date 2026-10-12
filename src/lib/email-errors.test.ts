import { describe, expect, it } from "vitest";
import { DAILY_LIMIT_ERROR, failedEmailAction, RETRIED_PREFIX } from "./email-errors";

const createdAt = new Date("2026-10-11T15:00:00Z");

describe("failedEmailAction", () => {
  it("offers a retry for a send failure", () => {
    expect(
      failedEmailAction({ error: "O servidor SMTP recusou o envio.", createdAt }, "2026-10-11"),
    ).toBe("retry");
  });

  it("waits for the next day after the daily limit", () => {
    expect(failedEmailAction({ error: DAILY_LIMIT_ERROR, createdAt }, "2026-10-11")).toBe(
      "tomorrow",
    );
    expect(failedEmailAction({ error: DAILY_LIMIT_ERROR, createdAt }, "2026-10-12")).toBe("retry");
  });

  it("offers nothing once it was sent again", () => {
    expect(
      failedEmailAction(
        { error: `${RETRIED_PREFIX}${DAILY_LIMIT_ERROR}`, createdAt },
        "2026-10-12",
      ),
    ).toBe("retried");
  });
});
