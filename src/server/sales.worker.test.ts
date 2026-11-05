import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leadEvents, leads, meetings, proposals, searches, users } from "@/db/schema";
import { PAST_MEETING_MESSAGE } from "@/lib/meetings";
import { createFakeMailer } from "../../test/fake-mailer";
import { resetDb } from "../../test/reset-db";
import { agendaEntries, agendaSummary, todayEntries } from "./agenda-store";
import { retryEmail } from "./conversation";
import { sendDue } from "./mail-flow";
import {
  cancelMeeting,
  LEAD_ENDED_MESSAGE,
  scheduleMeeting,
  upcomingMeetings,
} from "./meeting-store";
import { latestProposal, saveProposal } from "./proposal-store";
import {
  SALES_EMAILS_OFF_MESSAGE,
  SALES_EMAILS_OFF_REASON,
  SALES_RETRY_OFF_MESSAGE,
} from "./sales-mail";
import {
  archiveAddon,
  archiveService,
  createAddon,
  createService,
  loadServiceTable,
  SERVICE_NOT_FOUND,
  updateService,
} from "./service-store";

const db = getDb(env.DB);
// Tuesday, 14:00 in Brazil.
const now = new Date("2026-11-03T17:00:00Z");
const off = { emailsEnabled: false, fromAddress: "eu@nelcota.test" };
const on = { emailsEnabled: true, fromAddress: "eu@nelcota.test" };
const meeting = {
  leadId: "a",
  day: "2026-11-05",
  time: "10:00",
  kind: "video" as const,
  note: "Mostrar exemplos",
  sendInvite: false,
};

const lead = (id = "a") => db.query.leads.findFirst({ where: eq(leads.id, id) });
const eventKinds = (id = "a") =>
  db
    .select({ kind: leadEvents.kind, from: leadEvents.fromValue, to: leadEvents.toValue })
    .from(leadEvents)
    .where(eq(leadEvents.leadId, id));
const outgoing = () => db.select().from(emails);

async function seedTable() {
  const site = await createService(db, {
    name: "Site institucional",
    detail: "",
    priceCents: 99_000,
    monthly: false,
    deadlineDays: 10,
  });
  const domain = await createAddon(db, {
    name: "Domínio e e-mail profissional",
    scope: "Todos os sites",
    priceCents: 19_000,
    monthly: false,
  });
  return { site: site.id, domain: domain.id };
}

beforeEach(async () => {
  await resetDb();
  await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
  await db.insert(users).values([
    { id: "u1", name: "Haniel", email: "haniel@nelcota.test", passwordHash: "x" },
    { id: "u2", name: "Bia", email: "bia@nelcota.test", passwordHash: "x" },
  ]);
  const base = { searchId: "s", email: "contato@clinica.test", contactedAt: now };
  await db.insert(leads).values([
    { ...base, id: "a", placeId: "pa", name: "Clínica A", status: "replied", ownerId: "u1" },
    { ...base, id: "b", placeId: "pb", name: "Clínica B", status: "contacted" },
    { ...base, id: "c", placeId: "pc", name: "Clínica C", status: "replied", email: null },
  ]);
});

describe("meetings", () => {
  it("books a meeting, moves a replied lead to Reunião and writes the events", async () => {
    const result = await scheduleMeeting(db, meeting, "u1", off, now);
    expect(result.queued).toBe(false);
    expect(result.invite.body).toContain("Equipe Nelcota");
    expect(await lead()).toMatchObject({ salesStage: "meeting" });
    expect(await db.query.meetings.findFirst()).toMatchObject({
      leadId: "a",
      startsAt: new Date("2026-11-05T13:00:00Z"),
      kind: "video",
      note: "Mostrar exemplos",
      createdBy: "u1",
      inviteEmailId: null,
    });
    expect(await eventKinds()).toEqual(
      expect.arrayContaining([
        { kind: "meeting", from: null, to: "2026-11-05T13:00:00.000Z" },
        { kind: "stage", from: null, to: "meeting" },
      ]),
    );
  });

  it("keeps a later stage and leaves leads that did not reply alone", async () => {
    await db.update(leads).set({ salesStage: "proposal" }).where(eq(leads.id, "a"));
    await scheduleMeeting(db, meeting, "u1", off, now);
    expect(await lead()).toMatchObject({ salesStage: "proposal" });
    await scheduleMeeting(db, { ...meeting, leadId: "b" }, "u1", off, now);
    expect(await lead("b")).toMatchObject({ salesStage: null, status: "contacted" });
    expect((await eventKinds()).filter((event) => event.kind === "stage")).toEqual([]);
  });

  it("writes one stage line when two bookings race on the same lead", async () => {
    await Promise.all([
      scheduleMeeting(db, meeting, "u1", off, now),
      scheduleMeeting(db, { ...meeting, time: "11:00" }, "u2", off, now),
    ]);
    expect(await db.$count(meetings)).toBe(2);
    expect((await eventKinds()).filter((event) => event.kind === "stage")).toEqual([
      { kind: "stage", from: null, to: "meeting" },
    ]);
  });

  it("refuses a meeting in the past", async () => {
    await expect(
      scheduleMeeting(db, { ...meeting, day: "2026-11-03", time: "13:00" }, "u1", off, now),
    ).rejects.toThrow(PAST_MEETING_MESSAGE);
  });

  it("cancels: off the lead's list and the agenda, with a history line", async () => {
    const { id } = await scheduleMeeting(db, meeting, "u1", off, now);
    expect(await upcomingMeetings(db, "a", now)).toHaveLength(1);
    await cancelMeeting(db, id, "u2", now);
    await cancelMeeting(db, id, "u2", now);
    expect(await upcomingMeetings(db, "a", now)).toEqual([]);
    expect(await db.query.meetings.findFirst()).toMatchObject({ cancelledAt: now });
    expect((await eventKinds()).filter((event) => event.to === "cancelled")).toHaveLength(1);
  });
});

describe("the e-mail flag", () => {
  it("off: nothing is queued, and asking to send is refused", async () => {
    await scheduleMeeting(db, meeting, "u1", off, now);
    await expect(
      scheduleMeeting(db, { ...meeting, sendInvite: true }, "u1", off, now),
    ).rejects.toThrow(SALES_EMAILS_OFF_MESSAGE);
    expect(await outgoing()).toEqual([]);
  });

  it("on: one invite queued to the lead, signed by the team, and sent by the regular send", async () => {
    const result = await scheduleMeeting(db, { ...meeting, sendInvite: true }, "u1", on, now);
    expect(result.queued).toBe(true);
    const queued = await outgoing();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      status: "queued",
      author: "user",
      toAddress: "contato@clinica.test",
      subject: result.invite.subject,
    });
    expect(queued[0]?.body.endsWith("\n\nEquipe Nelcota")).toBe(true);
    expect((await db.query.meetings.findFirst())?.inviteEmailId).toBe(queued[0]?.id);

    const fake = createFakeMailer("eu@nelcota.test");
    await sendDue({ db, mailer: fake.mailer, limit: 30, salesEmails: true }, now);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toMatchObject({
      to: "contato@clinica.test",
      subject: result.invite.subject,
    });
  });

  it("turned off after queueing: the queued invite and proposal are cancelled, not sent", async () => {
    const table = await seedTable();
    await scheduleMeeting(db, { ...meeting, sendInvite: true }, "u1", on, now);
    const input = { leadId: "a", serviceId: table.site, addonIds: [], custom: [], sendEmail: true };
    await saveProposal(db, input, "u1", on, now);
    const fake = createFakeMailer("eu@nelcota.test");
    await sendDue({ db, mailer: fake.mailer, limit: 30 }, now);
    await sendDue({ db, mailer: fake.mailer, limit: 30 }, now);
    expect(fake.sent).toEqual([]);
    expect((await outgoing()).map((row) => [row.status, row.error])).toEqual([
      ["cancelled", SALES_EMAILS_OFF_REASON],
      ["cancelled", SALES_EMAILS_OFF_REASON],
    ]);
  });

  it("retrying a failed invite is refused while off, and follows the new e-mail when on", async () => {
    await scheduleMeeting(db, { ...meeting, sendInvite: true }, "u1", on, now);
    const [invite] = await outgoing();
    await db
      .update(emails)
      .set({ status: "failed", error: "SMTP" })
      .where(eq(emails.id, invite?.id ?? ""));
    await expect(
      retryEmail(db, invite?.id ?? "", { fromAddress: "eu@nelcota.test", now }),
    ).rejects.toThrow(SALES_RETRY_OFF_MESSAGE);
    const retried = await retryEmail(db, invite?.id ?? "", {
      fromAddress: "eu@nelcota.test",
      now,
      salesEmails: true,
    });
    expect((await db.query.meetings.findFirst())?.inviteEmailId).toBe(retried.id);
  });

  it("refuses a meeting or a proposal for a closed or discarded lead", async () => {
    const table = await seedTable();
    const input = {
      leadId: "a",
      serviceId: table.site,
      addonIds: [],
      custom: [],
      sendEmail: false,
    };
    for (const status of ["closed", "discarded"] as const) {
      await db.update(leads).set({ status }).where(eq(leads.id, "a"));
      await expect(scheduleMeeting(db, meeting, "u1", off, now)).rejects.toThrow(
        LEAD_ENDED_MESSAGE,
      );
      await expect(saveProposal(db, input, "u1", off, now)).rejects.toThrow(LEAD_ENDED_MESSAGE);
    }
    expect(await db.$count(meetings)).toBe(0);
    expect(await db.$count(proposals)).toBe(0);
  });

  it("on: cancelling the meeting cancels an invite still in the queue", async () => {
    const { id } = await scheduleMeeting(db, { ...meeting, sendInvite: true }, "u1", on, now);
    await cancelMeeting(db, id, "u1", now);
    expect((await outgoing())[0]).toMatchObject({ status: "cancelled" });
  });

  it("on: a lead without e-mail cannot get one", async () => {
    await expect(
      scheduleMeeting(db, { ...meeting, leadId: "c", sendInvite: true }, "u1", on, now),
    ).rejects.toThrow("Este lead não tem e-mail.");
  });
});

describe("proposals", () => {
  it("copies the lines from the table, totals them and moves the lead to Proposta", async () => {
    const table = await seedTable();
    await db.update(leads).set({ salesStage: "meeting" }).where(eq(leads.id, "a"));
    const result = await saveProposal(
      db,
      {
        leadId: "a",
        serviceId: table.site,
        addonIds: [table.domain],
        custom: [{ label: "Galeria de fotos", priceCents: 20_000 }],
        sendEmail: false,
      },
      "u1",
      off,
      now,
    );
    expect(result).toMatchObject({ totalCents: 138_000, queued: false });
    // A later price change does not touch the proposal already made.
    await updateService(db, {
      id: table.site,
      name: "Site institucional",
      detail: "",
      priceCents: 150_000,
      monthly: false,
      deadlineDays: 10,
    });
    const saved = await latestProposal(db, "a");
    expect(saved?.items).toEqual([
      { kind: "service", label: "Site institucional", priceCents: 99_000, monthly: false },
      { kind: "addon", label: "Domínio e e-mail profissional", priceCents: 19_000, monthly: false },
      { kind: "custom", label: "Galeria de fotos", priceCents: 20_000, monthly: false },
    ]);
    expect(saved).toMatchObject({ totalCents: 138_000, validDays: 15, sentAt: null });
    expect(await lead()).toMatchObject({ salesStage: "proposal" });
    expect(await eventKinds()).toEqual(
      expect.arrayContaining([
        { kind: "proposal", from: null, to: "138000" },
        { kind: "stage", from: "meeting", to: "proposal" },
      ]),
    );
    expect(await outgoing()).toEqual([]);
  });

  it("writes one stage line when two proposals race on the same lead", async () => {
    const table = await seedTable();
    const input = {
      leadId: "a",
      serviceId: table.site,
      addonIds: [],
      custom: [],
      sendEmail: false,
    };
    await Promise.all([
      saveProposal(db, input, "u1", off, now),
      saveProposal(db, input, "u2", off, now),
    ]);
    expect(await db.$count(proposals)).toBe(2);
    expect((await eventKinds()).filter((event) => event.kind === "stage")).toEqual([
      { kind: "stage", from: null, to: "proposal" },
    ]);
  });

  it("refuses an archived service and, with the flag on, queues one signed e-mail", async () => {
    const table = await seedTable();
    const input = { leadId: "a", serviceId: table.site, addonIds: [], custom: [], sendEmail: true };
    const result = await saveProposal(db, input, "u1", on, now);
    expect(result.queued).toBe(true);
    const queued = await outgoing();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ toAddress: "contato@clinica.test", status: "queued" });
    expect(queued[0]?.body).toContain("Total: R$ 990.");
    expect(queued[0]?.body.endsWith("Equipe Nelcota")).toBe(true);
    // Queued is not sent: the proposal says so only once the e-mail goes out.
    expect(await db.query.proposals.findFirst()).toMatchObject({
      emailId: queued[0]?.id,
      sentAt: null,
    });
    expect(await latestProposal(db, "a")).toMatchObject({ emailStatus: "queued", sentAt: null });
    const fake = createFakeMailer("eu@nelcota.test");
    await sendDue({ db, mailer: fake.mailer, limit: 30, salesEmails: true }, now);
    expect(await latestProposal(db, "a")).toMatchObject({ emailStatus: "sent", sentAt: now });

    await archiveService(db, table.site, now);
    await expect(saveProposal(db, { ...input, sendEmail: false }, "u1", on, now)).rejects.toThrow(
      SERVICE_NOT_FOUND,
    );
    expect(await db.$count(proposals)).toBe(1);
  });
});

describe("service table", () => {
  it("adds rows at the end and archived rows leave the table", async () => {
    const table = await seedTable();
    const second = await createService(db, {
      name: "Loja virtual",
      detail: "",
      priceCents: 249_000,
      monthly: false,
      deadlineDays: 25,
    });
    expect((await loadServiceTable(db)).services.map((row) => [row.name, row.position])).toEqual([
      ["Site institucional", 0],
      ["Loja virtual", 1],
    ]);
    await archiveService(db, second.id, now);
    await archiveAddon(db, table.domain, now);
    const after = await loadServiceTable(db);
    expect(after.services.map((row) => row.name)).toEqual(["Site institucional"]);
    expect(after.addons).toEqual([]);
    await expect(archiveService(db, second.id, now)).rejects.toThrow(SERVICE_NOT_FOUND);
  });
});

describe("agenda", () => {
  it("lists meetings and follow-ups, filters by owner and counts conversions", async () => {
    await db.update(leads).set({ followUpOn: "2026-11-03" }).where(eq(leads.id, "b"));
    await scheduleMeeting(db, meeting, "u1", off, now);
    await scheduleMeeting(
      db,
      { ...meeting, leadId: "b", day: "2026-11-03", time: "16:30" },
      "u2",
      off,
      now,
    );

    const all = await agendaEntries(db, { from: "2026-11-03", to: "2026-11-16", ownerId: null });
    expect(
      all.map((entry) => [entry.kind, entry.leadName, entry.day, entry.time, entry.ownerName]),
    ).toEqual(
      expect.arrayContaining([
        ["meeting", "Clínica A", "2026-11-05", "10:00", "Haniel"],
        ["meeting", "Clínica B", "2026-11-03", "16:30", "Bia"],
        ["followup", "Clínica B", "2026-11-03", null, null],
      ]),
    );
    expect(all).toHaveLength(3);
    const mine = await agendaEntries(db, { from: "2026-11-03", to: "2026-11-16", ownerId: "u1" });
    expect(mine.map((entry) => entry.leadName)).toEqual(["Clínica A"]);
    expect(await todayEntries(db, now)).toHaveLength(2);

    await db.update(leads).set({ status: "closed" }).where(eq(leads.id, "a"));
    await db
      .update(leads)
      .set({ status: "replied", salesStage: "proposal" })
      .where(eq(leads.id, "c"));
    expect(await agendaSummary(db, null)).toEqual({
      proposalsToPresent: 1,
      leadsWithMeeting: 2,
      closedAfterMeeting: 1,
    });
    expect(await db.$count(meetings)).toBe(2);
  });

  it("keeps overdue follow-ups (like Retornar hoje) and drops meetings of discarded leads", async () => {
    // B's return was due last Friday; C is closed, so its old follow-up day does not count.
    await db.update(leads).set({ followUpOn: "2026-10-30" }).where(eq(leads.id, "b"));
    await db
      .update(leads)
      .set({ followUpOn: "2026-10-29", status: "closed" })
      .where(eq(leads.id, "c"));
    await scheduleMeeting(db, { ...meeting, day: "2026-11-03", time: "16:00" }, "u1", off, now);

    const today = await todayEntries(db, now);
    expect(today.map((entry) => [entry.kind, entry.leadName, entry.day])).toEqual(
      expect.arrayContaining([
        ["meeting", "Clínica A", "2026-11-03"],
        ["followup", "Clínica B", "2026-10-30"],
      ]),
    );
    expect(today).toHaveLength(2);
    const range = { from: "2026-11-03", to: "2026-11-16", ownerId: null };
    expect((await agendaEntries(db, range)).map((entry) => entry.day)).toContain("2026-10-30");

    await db.update(leads).set({ status: "discarded" }).where(eq(leads.id, "a"));
    expect((await todayEntries(db, now)).map((entry) => entry.kind)).toEqual(["followup"]);
  });
});
