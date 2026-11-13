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
    // Conta keeps the six tasks folded behind "Ver tarefas".
    await status.getByRole("button", { name: "Ver tarefas" }).click();
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

test.describe("help", () => {
  test("? opens the help from any screen, except while typing, and Esc closes it", async ({
    page,
  }) => {
    await visit(page, "/conta");
    const help = page.getByRole("dialog", { name: "Ajuda" });

    // Typing "?" in a field is just text. The sender name is a field only after "Editar".
    await page.getByRole("button", { name: "Editar nome na assinatura" }).click();
    const name = page.getByLabel("Nome na assinatura");
    await name.fill("Ana");
    await name.press("Shift+Slash");
    await expect(name).toHaveValue("Ana?");
    await expect(help).toHaveCount(0);
    // Leave without saving: the field closes and the focus goes back to "Editar".
    await page.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Editar nome na assinatura" }).blur();

    await page.keyboard.press("Shift+Slash");
    await expect(help).toBeVisible();
    await expect(help.getByRole("heading", { name: "Como funciona" })).toBeVisible();
    await expect(help.getByText("Abrir esta ajuda")).toBeVisible();
    await expect(help.getByText("Nota mínima", { exact: true })).toBeVisible();
    await expect(help.getByText("Nenhuma tarefa automática falhando.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();

    // The sidebar button opens it too, and its Status line leads to Conta → Status.
    await page.getByRole("button", { name: "Ajuda" }).click();
    await expect(help).toBeVisible();
    await help.getByRole("link", { name: /Ver status/ }).click();
    await expect(help).toBeHidden();
    await expect(page).toHaveURL(/\/conta#status$/);
    await expect(page.getByRole("heading", { name: "Sistema" })).toBeVisible();
  });
});

test.describe("concept tips", () => {
  test("the InfoTip explains its concept on keyboard focus and on tap", async ({ page }) => {
    await visit(page, "/settings?aba=automacao");
    const tip = page
      .getByRole("heading", { name: /^O que roda sozinho/ })
      .getByRole("button", { name: "Mais informações" });
    await tip.focus();
    await expect(page.getByRole("tooltip")).toContainText("O que o app faz sozinho");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    // Touch screens have no hover: a tap opens it too.
    await tip.click();
    await expect(page.getByRole("tooltip")).toContainText("O que o app faz sozinho");

    // The sidebar meter explains the daily limit on itself, without an extra icon.
    await page.getByRole("group", { name: "0 de 30 e-mails hoje" }).focus();
    await expect(
      page.getByRole("tooltip", { name: /^Quantos e-mails saem por dia/ }),
    ).toBeVisible();
  });
});
