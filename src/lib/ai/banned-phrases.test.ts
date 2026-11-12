import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/server/settings-store";
import { buildProposalItems } from "../proposal";
import { meetingInviteEmail, proposalEmail } from "../sales-email";
import { BANNED_PHRASES, bannedPhrasesRule } from "./banned-phrases";
import {
  EMAIL_CLOSINGS,
  EMAIL_OPENINGS,
  emailSystemPrompt,
  emailUserPrompt,
  followUpSystemPrompt,
  type LeadContext,
  messageSystemPrompt,
  pickFor,
  replySystemPrompt,
} from "./prompts";

const LEAD: LeadContext = {
  niche: "dentista",
  name: "Clínica Sorriso",
  address: null,
  city: "Belo Horizonte",
  hasPhone: true,
  website: null,
  rating: null,
  reviewCount: null,
  siteStatus: "none",
  siteData: null,
  siteText: null,
};

const SETTINGS = { ...DEFAULT_SETTINGS, offer: "Crio sites para clínicas." };

const ANALYSIS = { summary: "Clínica odontológica.", signals: [], painPoints: [] };

const WRITING_PROMPTS = {
  email: emailSystemPrompt(),
  whatsapp: messageSystemPrompt(),
  followUp: followUpSystemPrompt(),
  reply: replySystemPrompt(),
};

describe("banned phrases", () => {
  it("lists the reply tics and the fixed meeting length", () => {
    expect(BANNED_PHRASES).toEqual(
      expect.arrayContaining(["Ótima pergunta!", "Fico à disposição", "15 minutos"]),
    );
  });

  it("has no duplicates, ignoring case", () => {
    const lower = BANNED_PHRASES.map((phrase) => phrase.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it("forbids exclamation marks in the rule", () => {
    expect(bannedPhrasesRule()).toContain("Sem ponto de exclamação");
  });

  it.each(Object.entries(WRITING_PROMPTS))("is printed whole by the %s prompt", (_, prompt) => {
    expect(prompt).toContain(bannedPhrasesRule());
  });

  it.each(Object.entries(WRITING_PROMPTS))(
    "the %s prompt no longer prescribes a formula",
    (_, prompt) => {
      expect(prompt).not.toMatch(/tudo bem\?/i);
      expect(prompt).not.toContain("conversar 15 minutos");
      expect(prompt).not.toContain("no máximo um ponto de exclamação");
    },
  );
});

describe("first e-mail opening and closing", () => {
  it("the user prompt carries one opening and one closing", () => {
    const prompt = emailUserPrompt(SETTINGS, LEAD, ANALYSIS);
    expect(prompt).toContain(`## Abertura\n${pickFor(EMAIL_OPENINGS, LEAD.name)}`);
    expect(prompt).toContain(`## Fecho\n${pickFor(EMAIL_CLOSINGS, `${LEAD.name}|fecho`)}`);
  });

  it("the same lead always gets the same choice", () => {
    expect(pickFor(EMAIL_OPENINGS, "Padaria Pão Bom")).toBe(
      pickFor(EMAIL_OPENINGS, "Padaria Pão Bom"),
    );
  });

  it("a batch of leads does not all open the same way", () => {
    const names = Array.from({ length: 40 }, (_, index) => `Empresa ${index}`);
    const openings = new Set(names.map((name) => pickFor(EMAIL_OPENINGS, name)));
    const closings = new Set(names.map((name) => pickFor(EMAIL_CLOSINGS, `${name}|fecho`)));
    expect(openings.size).toBe(EMAIL_OPENINGS.length);
    expect(closings.size).toBe(EMAIL_CLOSINGS.length);
  });

  it("no opening or closing uses a banned phrase", () => {
    const options = [...EMAIL_OPENINGS, ...EMAIL_CLOSINGS].join("\n").toLowerCase();
    for (const phrase of BANNED_PHRASES) expect(options).not.toContain(phrase.toLowerCase());
  });
});

describe("sales templates without formula", () => {
  const leadName = "ODONTO ART BH DENTISTA 24 HORAS";

  it("the meeting invite opens with the date, not the Google name", () => {
    const { body } = meetingInviteEmail({
      leadName,
      startsAt: new Date("2026-11-05T13:00:00Z"),
      kind: "video",
      note: "",
    });
    expect(body).not.toContain(leadName);
    expect(body).not.toContain("!");
    expect(body.startsWith("Nossa conversa fica marcada para quinta-feira, 05/11, às 10:00")).toBe(
      true,
    );
  });

  it("the proposal has no greeting by name and no stock phrase", () => {
    const items = buildProposalItems(
      { name: "Site institucional", priceCents: 99_000, monthly: false },
      [],
      [],
    );
    const { body } = proposalEmail({ leadName, items, validDays: 15, today: "2026-11-03" });
    expect(body).not.toContain(leadName);
    expect(body).not.toContain("!");
    for (const phrase of BANNED_PHRASES) {
      expect(body.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });
});
