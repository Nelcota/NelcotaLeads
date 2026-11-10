import { describe, expect, it } from "vitest";
import { MAIL_MISSING_REASON, replySendState } from "./reply-send";

describe("replySendState", () => {
  it("sends a written reply when the inbox is connected", () => {
    expect(replySendState({ body: "Oi", pending: false, mailConfigured: true })).toEqual({
      canSend: true,
      reason: null,
    });
  });

  it("does not send an empty reply or one already going out", () => {
    expect(replySendState({ body: "  \n", pending: false, mailConfigured: true }).canSend).toBe(
      false,
    );
    expect(replySendState({ body: "Oi", pending: true, mailConfigured: true }).canSend).toBe(false);
  });

  it("blocks with the reason while no inbox is connected", () => {
    expect(replySendState({ body: "Oi", pending: false, mailConfigured: false })).toEqual({
      canSend: false,
      reason: MAIL_MISSING_REASON,
    });
  });

  it("does not block while the inbox status is still loading", () => {
    expect(replySendState({ body: "Oi", pending: false, mailConfigured: undefined })).toEqual({
      canSend: true,
      reason: null,
    });
  });
});
