import type { Page } from "@playwright/test";
import { expect, test, tickTimes, visit, type Backend } from "./fixtures";

const LEAD = { name: "Clínica Sorriso", email: "contato@sorriso.test" };

/** Writes and sends the first e-mail from the lead panel; returns its Message-ID. */
async function startConversation(page: Page, backend: Backend) {
  const { id } = await backend.lead(LEAD);
  await visit(page, `/leads?lead=${id}`);
  const panel = page.getByRole("dialog", { name: LEAD.name });
  await panel.getByRole("button", { name: "Escrever e-mail" }).click();
  await expect(panel.getByLabel("Assunto")).toHaveValue(`Assunto para ${LEAD.name}`);
  await panel.getByRole("button", { name: "Enviar e-mail" }).click();
  await expect(page.getByText("E-mail enviado")).toBeVisible();

  const sent = await backend.sent();
  expect(sent).toHaveLength(1);
  const first = sent[0];
  if (!first) throw new Error("first e-mail not sent");
  expect(first.to).toBe(LEAD.email);
  return { id, messageId: first.messageId, subject: first.subject };
}

test.describe("e-mail conversations", () => {
  test("the AI answers a threaded reply on the next ticks", async ({ page, backend }) => {
    const [poll, send] = tickTimes(2);
    const { id, messageId, subject } = await startConversation(page, backend);

    await backend.inbound({
      from: LEAD.email,
      subject: `Re: ${subject}`,
      text: "Oi! Pode me contar mais sobre isso?",
      inReplyTo: messageId,
    });
    await backend.tick(poll);

    await visit(page, "/conversas");
    const row = page.getByRole("button", { name: new RegExp(LEAD.name) });
    await expect(row).toContainText("IA conversando");
    await row.click();
    await expect(page).toHaveURL(new RegExp(`lead=${id}`));
    await expect(page.getByText("Oi! Pode me contar mais sobre isso?")).toBeVisible();
    await expect(page.getByRole("switch", { name: /IA/ })).toBeChecked();

    // The AI reply waits a couple of minutes and skips the gap between first e-mails.
    await backend.tick(send);
    const sent = await backend.sent();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.to).toBe(LEAD.email);
    expect(sent[1]?.subject).toBe(`Re: ${subject}`);
    expect(sent[1]?.text).toContain("Resposta da IA");
    expect(sent[1]?.inReplyTo).toMatch(/@cliente\.test>$/);

    await page.reload();
    const reply = page.getByRole("article").filter({ hasText: "Resposta da IA" });
    await expect(reply).toContainText("IA, em seu nome");
    await expect(page.getByRole("article")).toHaveCount(3);
  });

  test("a question about price hands the conversation to the user", async ({ page, backend }) => {
    const [poll, later] = tickTimes(2);
    const { id, messageId, subject } = await startConversation(page, backend);

    await backend.inbound({
      from: LEAD.email,
      subject: `Re: ${subject}`,
      text: "Quanto custa? Qual o valor do serviço?",
      inReplyTo: messageId,
    });
    await backend.tick(poll);
    await backend.tick(later);
    expect(await backend.sent()).toHaveLength(1);

    await visit(page, `/conversas?lead=${id}`);
    await expect(
      page.getByRole("button", { name: new RegExp(LEAD.name) }).getByText("Precisa de você"),
    ).toBeVisible();
    await expect(page.getByText("A IA parou: Teste: handoff")).toBeVisible();
    await expect(page.getByRole("switch", { name: /IA/ })).not.toBeChecked();
    await expect(page.getByLabel("Sua resposta")).toHaveValue("Rascunho para você");
  });

  test("an opt-out unsubscribes the lead and blocks new e-mails", async ({ page, backend }) => {
    const [poll, later] = tickTimes(2);
    const { id, messageId, subject } = await startConversation(page, backend);

    await backend.inbound({
      from: LEAD.email,
      subject: `Re: ${subject}`,
      text: "sair",
      inReplyTo: messageId,
    });
    await backend.tick(poll);

    await visit(page, `/conversas?lead=${id}`);
    await expect(
      page.getByRole("button", { name: new RegExp(LEAD.name) }).getByText("Encerrada"),
    ).toBeVisible();
    await expect(page.getByLabel("Sua resposta")).toHaveCount(0);

    // The lead is out of every send: no checkbox can make it go.
    await visit(page, "/leads?view=all");
    const row = page.getByRole("row").filter({ hasText: LEAD.name });
    await expect(row).toContainText("descadastrado");
    await expect(row).toContainText("Descartado");
    await page.getByRole("checkbox", { name: `Selecionar ${LEAD.name}` }).check();
    await expect(page.getByText("1 sem e-mail fica de fora")).toBeVisible();
    await expect(page.getByRole("button", { name: "Disparar e-mail" })).toBeDisabled();

    await backend.tick(later);
    expect(await backend.sent()).toHaveLength(1);
  });
});
