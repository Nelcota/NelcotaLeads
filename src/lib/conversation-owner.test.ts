import { describe, expect, it } from "vitest";
import { conversationOwner } from "./conversation-owner";

describe("conversationOwner", () => {
  it("offers to take over while the AI answers", () => {
    expect(conversationOwner(true)).toEqual({
      answeredBy: "ai",
      label: "A IA responde esta conversa",
      action: { label: "Assumir conversa", aiMode: false },
    });
  });

  it("offers to give it back while the team answers", () => {
    expect(conversationOwner(false)).toEqual({
      answeredBy: "you",
      label: "Você responde esta conversa",
      action: { label: "Devolver para a IA", aiMode: true },
    });
  });
});
