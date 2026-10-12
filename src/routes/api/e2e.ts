import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { DEFAULT_SETTINGS, storeSettings } from "@/server/settings-store";
import { runTick } from "@/server/tick";
import type { E2eFault } from "../../../e2e/fakes/faults";
import type { E2eMailbox } from "../../../e2e/fakes/mail";

const TABLES = ["emails", "analyses", "leads", "searches", "settings", "api_usage"];

// Listed here rather than imported, so no fake module code reaches this route's bundle.
const FAULTS = ["places", "writeEmail", "mailSend"] as const satisfies readonly E2eFault[];

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("tick"), now: z.iso.datetime() }),
  z.object({ action: z.literal("sent") }),
  z.object({
    action: z.literal("inbound"),
    from: z.string(),
    subject: z.string(),
    text: z.string(),
    inReplyTo: z.string().nullable(),
  }),
  z.object({
    action: z.literal("lead"),
    name: z.string(),
    website: z.string().nullable(),
    email: z.string().nullable(),
  }),
  // Arms a one-shot failure in a fake: the next Places search, AI e-mail draft or send throws.
  z.object({ action: z.literal("fault"), fault: z.enum(FAULTS) }),
]);

/**
 * Test-only control surface for the Playwright suite: reset data, run the cron, play the
 * mailbox. `NELCOTA_E2E` is a build-time `false` outside `E2E=1 vite dev`, so this answers 404
 * everywhere else. Still behind the login gate like every other route.
 */
export const Route = createFileRoute("/api/e2e")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!NELCOTA_E2E) return new Response("Not found", { status: 404 });
        const mailbox: E2eMailbox | undefined = globalThis.nelcotaE2eMailbox;
        const input = actionSchema.parse(await request.json());

        switch (input.action) {
          case "reset":
            await env.DB.batch(TABLES.map((table) => env.DB.prepare(`DELETE FROM ${table}`)));
            mailbox?.sent.splice(0);
            mailbox?.inbox.splice(0);
            globalThis.nelcotaE2eFaults?.clear();
            // Searches are blocked until an offer exists; every test starts with one.
            await storeSettings(getDb(), {
              ...DEFAULT_SETTINGS,
              offer: "Sites e anúncios para clínicas",
              idealCustomer: "Clínicas com poucas avaliações",
              senderName: "Ana Teste",
              senderCompany: "Nelcota",
            });
            return Response.json({ ok: true });
          case "tick":
            await runTick(env, new Date(input.now));
            return Response.json({ ok: true });
          case "sent":
            return Response.json(mailbox?.sent ?? []);
          case "inbound":
            mailbox?.inbox.push({
              from: input.from,
              fromName: null,
              subject: input.subject,
              messageId: `<${crypto.randomUUID()}@cliente.test>`,
              inReplyTo: input.inReplyTo,
              references: input.inReplyTo ? [input.inReplyTo] : [],
              text: input.text,
              date: null,
              automatic: false,
            });
            return Response.json({ ok: true });
          case "lead": {
            const db = getDb();
            const searchId = crypto.randomUUID();
            const id = crypto.randomUUID();
            await db.insert(searches).values({
              id: searchId,
              niche: "e2e",
              city: "Teste",
              maxResults: 1,
              status: "done",
              foundCount: 1,
              analyzedCount: 1,
            });
            await db.insert(leads).values({
              id,
              searchId,
              placeId: `e2e-${id}`,
              name: input.name,
              website: input.website,
              email: input.email,
              siteStatus: "none",
              analysisStatus: "done",
              score: 80,
            });
            // Drafting an e-mail needs the analysis the queue would have written.
            await db.insert(analyses).values({
              id: crypto.randomUUID(),
              leadId: id,
              summary: `${input.name} em Teste`,
              signals: [],
              painPoints: [],
              score: 80,
              scoreReasoning: "Teste",
              model: "test-model",
            });
            return Response.json({ id });
          }
          case "fault":
            globalThis.nelcotaE2eFaults ??= new Set<E2eFault>();
            globalThis.nelcotaE2eFaults.add(input.fault);
            return Response.json({ ok: true });
        }
        return new Response("Bad request", { status: 400 });
      },
    },
  },
});
