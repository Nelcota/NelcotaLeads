import { expect, test, visit } from "./fixtures";

/**
 * Recent cron instants that read the inbox (minute % 5, never on the hour), oldest first, so
 * "há N min" reads as in real use.
 */
function recentInboxTicks(count: number): Date[] {
  let at = new Date();
  at.setUTCSeconds(0, 0);
  at.setUTCMinutes(at.getUTCMinutes() - (at.getUTCMinutes() % 5));
  const ticks: Date[] = [];
  while (ticks.length < count) {
    if (at.getUTCMinutes() !== 0) ticks.unshift(at);
    at = new Date(at.getTime() - 5 * 60_000);
  }
  return ticks;
}

const MAILBOX_REFUSED = "A caixa de e-mail recusou a conexão. Confira a senha em Configurações.";

test.describe("system status", () => {
  test("a mailbox that keeps refusing turns its task red and marks Conta in the sidebar", async ({
    page,
    backend,
  }) => {
    await visit(page, "/conta");
    const status = page.locator("#status");
    // Nothing failing: no dot on Conta.
    await expect(page.getByTestId("system-attention")).toHaveCount(0);

    await backend.fault("mailbox");
    for (const at of recentInboxTicks(3)) await backend.tick(at);

    await visit(page, "/conta");
    const inbox = status.locator('[data-job="inbox"]');
    await expect(inbox.getByRole("img", { name: "Falhando" })).toBeVisible();
    await expect(inbox.getByText(MAILBOX_REFUSED)).toBeVisible();
    // The raw server text never reaches the screen.
    await expect(page.getByText(/simulada|IMAP/)).toHaveCount(0);
    await expect(page.getByTestId("system-attention")).toBeVisible();

    // Once the mailbox works again, "Tentar agora" turns the task green.
    await backend.recover("mailbox");
    await inbox.getByRole("button", { name: "Tentar agora" }).click();
    await expect(inbox.getByRole("img", { name: "Funcionando" })).toBeVisible();
    await expect(inbox.getByText(MAILBOX_REFUSED)).toHaveCount(0);
    await expect(inbox.getByRole("button", { name: "Tentar agora" })).toHaveCount(0);
    await expect(page.getByTestId("system-attention")).toHaveCount(0);
  });
});
