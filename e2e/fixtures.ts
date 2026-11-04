import { z } from "zod";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Resolves once React hydrated the server-rendered page (it tags DOM nodes with its fiber),
 * so clicks and keys reach their handlers instead of landing on inert SSR markup. The shell
 * hydrates first and the route (a lazy chunk behind Suspense) after it, so the page content
 * is checked too: until it hydrates, its effects (such as the J/K listener) are not attached.
 */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const hasFiber = (node: Element) =>
      Object.keys(node).some((key) => key.startsWith("__reactFiber"));
    if (!hasFiber(document.body)) return false;
    const main = document.querySelector("main");
    if (!main) return true;
    return Array.from(main.querySelectorAll("*")).every(hasFiber);
  });
}

const serverFnIdSchema = z.object({ export: z.string() });

/**
 * The server function behind a `/_serverFn/<id>` URL, e.g. "getProviderStatus" (the id is
 * base64url JSON naming the export); null for any other URL.
 */
export function serverFnName(url: string): string | null {
  const id = /\/_serverFn\/([\w-]+)/.exec(url)?.[1];
  if (!id) return null;
  try {
    const parsed = serverFnIdSchema.safeParse(
      JSON.parse(Buffer.from(id, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data.export.replace(/_createServerFn_handler$/, "") : null;
  } catch {
    return null;
  }
}

/** `page.goto` plus hydration. */
export async function visit(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

/**
 * Opens the "Nova busca" dialog from the sidebar, which every page has. Pages such as Leads
 * and Buscas also show a "Nova busca" button of their own, so the role alone is ambiguous.
 */
export async function openNewSearch(page: Page) {
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Nova busca" })
    .click();
  return page.getByRole("dialog", { name: "Nova busca" });
}

/** `page.reload` plus hydration. */
export async function reload(page: Page) {
  await page.reload();
  await hydrated(page);
}

export type SentEmail = {
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string | null;
};

export type Fault = "places" | "writeEmail" | "mailSend" | "mailbox";

/** Drives the test-only `/api/e2e` route: data reset, cron ticks and the fake mailbox. */
export class Backend {
  constructor(private readonly request: APIRequestContext) {}

  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const response = await this.request.post("/api/e2e", { data: body });
    expect(response.ok(), await response.text()).toBe(true);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- shape owned by /api/e2e
    return (await response.json()) as T;
  }

  reset() {
    return this.call({ action: "reset" });
  }

  tick(now: Date) {
    return this.call({ action: "tick", now: now.toISOString() });
  }

  sent() {
    return this.call<SentEmail[]>({ action: "sent" });
  }

  inbound(email: { from: string; subject: string; text: string; inReplyTo: string | null }) {
    return this.call({ action: "inbound", ...email });
  }

  lead(lead: {
    name: string;
    website?: string | null;
    email?: string | null;
    phone?: string | null;
  }) {
    return this.call<{ id: string }>({
      action: "lead",
      name: lead.name,
      website: lead.website ?? null,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
    });
  }

  /** A search stuck analyzing (its leads never reach the queue), to cancel it. */
  runningSearch(search: { niche: string; city: string; leads: number }) {
    return this.call<{ id: string }>({ action: "runningSearch", ...search });
  }

  /** The next call of that fake throws once (`mailbox`: every call, until recovered). */
  fault(fault: Fault) {
    return this.call({ action: "fault", fault });
  }

  recover(fault: Fault) {
    return this.call({ action: "recover", fault });
  }
}

/**
 * Cron instants for `tick`, in order and 10 minutes apart: far enough ahead of the real clock
 * that anything queued during the test is due, past the 8-minute send gap of the previous one,
 * on a minute that reads the inbox (% 5) and never on the hour (autopilot, auto dispatch).
 */
export function tickTimes(count: number): Date[] {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCMinutes(5, 0, 0);
  return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * 10 * 60_000));
}

/** Console errors seen in the page; the test may allow the ones it provokes on purpose. */
export class ConsoleErrors {
  readonly seen: string[] = [];
  private readonly allowed: RegExp[] = [];

  allow(pattern: RegExp) {
    this.allowed.push(pattern);
  }

  unexpected() {
    return this.seen.filter((text) => !this.allowed.some((pattern) => pattern.test(text)));
  }
}

const SESSION = "e2e/.auth/session.json";

/** The account every signed-in test uses (created by auth.setup.ts). */
export const E2E_ACCOUNT = {
  name: "Conta E2E",
  email: "e2e@nelcota.test",
  password: "e2e-account-password",
};

export const test = base.extend<{ backend: Backend; consoleErrors: ConsoleErrors }>({
  // Auto: every test starts from the same data. Signed in on its own, so a test may use a
  // signed-out page (test.use({ storageState })) and still drive the backend.
  backend: [
    async ({ playwright, baseURL }, use) => {
      const request = await playwright.request.newContext({ baseURL, storageState: SESSION });
      const backend = new Backend(request);
      await backend.reset();
      await use(backend);
      await request.dispose();
    },
    { auto: true },
  ],
  // Auto: fails the test on any console error it didn't allow.
  consoleErrors: [
    async ({ page }, use) => {
      const errors = new ConsoleErrors();
      page.on("console", (message) => {
        if (message.type() === "error") errors.seen.push(message.text());
      });
      page.on("pageerror", (error) => errors.seen.push(error.message));
      await use(errors);
      expect(errors.unexpected(), "unexpected console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
