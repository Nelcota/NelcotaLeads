import { describe, expect, it } from "vitest";
import { defaultMeetingForm, meetingFromForm } from "./meetings";
import { EXAMPLE_ADDONS, EXAMPLE_SERVICES } from "./service-examples";
import { addonFromForm, serviceFromForm } from "./service-form";
import { addonInputSchema, serviceInputSchema, serviceTerms, usesExamplePrices } from "./services";

const service = { name: "Site", detail: "", priceCents: 99_000, monthly: false, deadlineDays: 10 };

describe("service validation", () => {
  it("accepts a priced service with a deadline, or a monthly one without", () => {
    expect(serviceInputSchema.safeParse(service).success).toBe(true);
    expect(
      serviceInputSchema.safeParse({ ...service, monthly: true, deadlineDays: null }).success,
    ).toBe(true);
  });

  it("rejects a zero price, an empty or long name and a one-off without deadline", () => {
    expect(serviceInputSchema.safeParse({ ...service, priceCents: 0 }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...service, name: " " }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...service, name: "x".repeat(81) }).success).toBe(false);
    expect(serviceInputSchema.safeParse({ ...service, deadlineDays: null }).success).toBe(false);
    expect(
      addonInputSchema.safeParse({ name: "Página", scope: "", priceCents: -1, monthly: false })
        .success,
    ).toBe(false);
  });

  it("reads the typed fields", () => {
    expect(
      serviceFromForm({ name: "Site", detail: "", price: "990", monthly: false, deadline: "10" }),
    ).toEqual({ ok: true, value: service });
    expect(
      serviceFromForm({ name: "Site", detail: "", price: "", monthly: false, deadline: "10" }).ok,
    ).toBe(false);
    expect(addonFromForm({ name: "Página", scope: "", price: "150", monthly: false })).toEqual({
      ok: true,
      value: { name: "Página", scope: "Todos os sites", priceCents: 15_000, monthly: false },
    });
  });

  it("shows price and deadline", () => {
    expect(serviceTerms(service)).toBe("R$ 990 · 10 dias");
    expect(
      serviceTerms({ ...service, priceCents: 69_000, monthly: true, deadlineDays: null }),
    ).toBe("R$ 690/mês");
  });
});

describe("usesExamplePrices", () => {
  it("is true only while every row is one of the seeded examples", () => {
    expect(usesExamplePrices(EXAMPLE_SERVICES, EXAMPLE_ADDONS)).toBe(true);
    expect(usesExamplePrices([], [])).toBe(false);
    const [first, ...rest] = EXAMPLE_SERVICES;
    if (!first) throw new Error("no examples");
    expect(usesExamplePrices([{ ...first, priceCents: 120_000 }, ...rest], EXAMPLE_ADDONS)).toBe(
      false,
    );
  });
});

describe("meeting form", () => {
  // Tuesday 14:00 in Brazil.
  const now = new Date("2026-11-03T17:00:00Z");

  it("defaults to the next workday at 10:00", () => {
    expect(defaultMeetingForm("2026-11-03", true)).toMatchObject({
      day: "2026-11-04",
      time: "10:00",
      sendInvite: true,
    });
    expect(defaultMeetingForm("2026-11-06", false).day).toBe("2026-11-09");
  });

  it("refuses a time that already passed", () => {
    const form = {
      day: "2026-11-03",
      time: "13:00",
      kind: "video" as const,
      note: "",
      sendInvite: false,
    };
    expect(meetingFromForm(form, now).ok).toBe(false);
    expect(meetingFromForm({ ...form, time: "15:00" }, now).ok).toBe(true);
    expect(meetingFromForm({ ...form, time: "25:00" }, now).ok).toBe(false);
  });
});
