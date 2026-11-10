import type { Page } from "@playwright/test";
import { expect, firstSendTime, reload, test, tickTimes, visit, type Backend } from "./fixtures";

const LEAD = { name: "Clínica Sorriso", email: "contato@sorriso.test" };
const OTHER = { name: "Clínica Aurora", email: "contato@aurora.test" };

/**
 * Writes and sends the first e-mail from the lead panel; returns its Message-ID. "Enviar"
 * queues it: it goes out right away inside the send window, else on the cron tick `sendAt`
 * (a second conversation also waits for the gap between first e-mails, so it passes a later
 * tick).
 */
async function startConversation(
  page: Page,
  backend: Backend,
  lead: { name: string; email: string; phone?: string } = LEAD,
  sendAt: Date = firstSendTime(),
) {
  const before = (await backend.sent()).length;
  const { id } = await backend.lead(lead);
  await visit(page, `/leads?lead=${id}`);
  const panel = page.getByRole("dialog", { name: lead.name });
  await panel.getByRole("button", { name: "Escrever e-mail" }).click();
  await expect(panel.getByLabel("Assunto")).toHaveValue(`Assunto para ${lead.name}`);
  await panel.getByRole("button", { name: "Enviar e-mail" }).click();
  await expect(page.getByText("E-mail na fila de envio")).toBeVisible();
  await backend.tick(sendAt);

  const sent = await backend.sent();
  expect(sent).toHaveLength(before + 1);
  const first = sent.at(-1);
  if (!first) throw new Error("first e-mail not sent");
  expect(first.to).toBe(lead.email);
  return { id, messageId: first.messageId, subject: first.subject };
}

/** "Fechar negócio" opens a form: the value and the service sold are required. */
async function closeWon(page: Page) {
  await page.getByRole("button", { name: "Fechar negócio" }).click();
  const form = page.getByRole("dialog", { name: "Fechar negócio" });
  await form.getByLabel("Valor").fill("1500");
  await form.getByLabel("Serviço").fill("Site institucional");
  await form.getByRole("button", { name: "Confirmar" }).click();
  await expect(form).toBeHidden();
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
    await expect(
      page.getByRole("article").filter({ hasText: "Oi! Pode me contar mais sobre isso?" }),
    ).toBeVisible();
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

    // The tab shows how many need the user, on every page.
    await expect(page).toHaveTitle("(1) Conversas · Nelcota Leads");
    await page.getByRole("link", { name: "Leads", exact: true }).click();
    await expect(page).toHaveTitle("(1) Leads · Nelcota Leads");
  });

  test("closing can be undone: same filter, same AI, same queue", async ({ page, backend }) => {
    const [poll, send] = tickTimes(2);
    const { id, messageId, subject } = await startConversation(page, backend);
    await backend.inbound({
      from: LEAD.email,
      subject: `Re: ${subject}`,
      text: "Oi! Pode me contar mais sobre isso?",
      inReplyTo: messageId,
    });
    await backend.tick(poll);

    await visit(page, `/conversas?filter=aiTalking&lead=${id}`);
    const row = page.getByRole("button", { name: new RegExp(LEAD.name) });
    await expect(row).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "na fila" })).toHaveCount(1);

    await closeWon(page);
    await expect(page.getByText(/^Negócio fechado: R\$\s1\.500$/)).toBeVisible();
    await expect(row).toBeHidden();
    await expect(page.getByRole("article").filter({ hasText: "Cancelado" })).toHaveCount(1);

    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(row).toBeVisible();
    await expect(row).toContainText("IA conversando");
    await expect(page.getByRole("switch", { name: /IA/ })).toBeChecked();
    await expect(page.getByRole("article").filter({ hasText: "na fila" })).toHaveCount(1);

    // The restored AI reply goes out once.
    await backend.tick(send);
    const sent = await backend.sent();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.text).toContain("Resposta da IA");
  });

  test("a closed conversation can be reopened", async ({ page, backend }) => {
    const { id } = await startConversation(page, backend);
    await visit(page, `/conversas?lead=${id}`);
    await closeWon(page);
    const row = page.getByRole("button", { name: new RegExp(LEAD.name) });
    await expect(row).toContainText("Encerrada");
    await expect(page.getByLabel("Sua resposta")).toHaveCount(0);

    await page.getByRole("button", { name: "Reabrir conversa" }).click();
    await expect(row).toContainText("Precisa de você");
    await expect(page.getByLabel("Sua resposta")).toBeVisible();
  });

  test("a reply being typed survives switching conversations and reloading", async ({
    page,
    backend,
  }) => {
    const [second] = tickTimes(1);
    const other = await startConversation(page, backend, OTHER);
    const { id } = await startConversation(page, backend, LEAD, second);
    await visit(page, `/conversas?lead=${id}`);
    const reply = page.getByLabel("Sua resposta");

    // Switching right away: the pending text is saved on the way out.
    await reply.fill("Oi! Posso te ligar amanhã às 10h?");
    await page.getByRole("button", { name: new RegExp(OTHER.name) }).click();
    await expect(page).toHaveURL(new RegExp(`lead=${other.id}`));
    await expect(reply).toHaveValue("");
    await page.getByRole("button", { name: new RegExp(LEAD.name) }).click();
    await expect(reply).toHaveValue("Oi! Posso te ligar amanhã às 10h?");

    await reply.fill("Oi! Posso te ligar amanhã às 11h?");
    await expect(page.getByText("Rascunho salvo")).toBeVisible();
    await reload(page);
    await expect(page.getByLabel("Sua resposta")).toHaveValue("Oi! Posso te ligar amanhã às 11h?");

    // Sending clears the draft for good.
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Sua resposta")).toHaveValue("");
    await reload(page);
    await expect(page.getByLabel("Sua resposta")).toHaveValue("");
    const sent = await backend.sent();
    expect(sent.at(-1)?.text).toContain("Oi! Posso te ligar amanhã às 11h?");
    // No message from the lead yet: it still carries the opt-out line.
    expect(sent.at(-1)?.text).toContain('responda com "sair"');
  });

  test("a failed send offers a retry that sends exactly once", async ({ page, backend }) => {
    const [t1, t2] = tickTimes(2);
    const { id } = await startConversation(page, backend);
    await backend.fault("mailSend");
    await visit(page, `/conversas?lead=${id}`);
    await page.getByLabel("Sua resposta").fill("Posso te ligar amanhã?");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(page.getByText("O servidor SMTP recusou o envio.", { exact: true })).toBeVisible();

    const failed = page.getByRole("article").filter({ hasText: "Posso te ligar amanhã?" });
    await expect(failed).toContainText("Não enviado");
    await failed.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(failed.first()).toContainText("reenviado");
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
    await expect(page.getByRole("article").filter({ hasText: "Na fila" })).toHaveCount(1);

    await backend.tick(t1);
    await backend.tick(t2);
    const sent = await backend.sent();
    expect(sent.filter((email) => email.text.includes("Posso te ligar amanhã?"))).toHaveLength(1);
  });

  test("a queued AI reply can go back to the composer before it is sent", async ({
    page,
    backend,
  }) => {
    const [poll, later] = tickTimes(2);
    const { id, messageId, subject } = await startConversation(page, backend);
    await backend.inbound({
      from: LEAD.email,
      subject: `Re: ${subject}`,
      text: "Oi! Pode me contar mais sobre isso?",
      inReplyTo: messageId,
    });
    await backend.tick(poll);

    await visit(page, `/conversas?lead=${id}`);
    const queued = page.getByRole("article").filter({ hasText: "na fila" });
    await queued.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Sua resposta")).toHaveValue("Resposta da IA");
    await expect(queued).toHaveCount(0);

    await backend.tick(later);
    expect(await backend.sent()).toHaveLength(1);
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
    await expect(row).toContainText("Descartado");
    await page.getByRole("checkbox", { name: `Selecionar ${LEAD.name}` }).check();
    await expect(page.getByText("1 fica de fora do disparo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Disparar 0 selecionados" })).toBeDisabled();

    await backend.tick(later);
    expect(await backend.sent()).toHaveLength(1);
  });

  test("Ctrl+Enter sends the reply once", async ({ page, backend }) => {
    const { id } = await startConversation(page, backend);
    await visit(page, `/conversas?lead=${id}`);
    const reply = page.getByLabel("Sua resposta");
    // An empty reply goes nowhere.
    await reply.press("Control+Enter");
    await reply.fill("Posso te ligar amanhã?");
    await page.getByRole("button", { name: "Enviar", exact: true }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Enviar Ctrl+Enter");

    await reply.press("Control+Enter");
    await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
    await expect(reply).toHaveValue("");
    const sent = await backend.sent();
    expect(sent).toHaveLength(2);
    expect(sent[1]?.text).toContain("Posso te ligar amanhã?");
  });

  test("searching by name filters the list and its counts", async ({ page, backend }) => {
    const [second] = tickTimes(1);
    await startConversation(page, backend, OTHER);
    await startConversation(page, backend, LEAD, second);
    await visit(page, "/conversas");
    const all = page.getByRole("button", { name: /Todas/ });
    await expect(all).toContainText("2");

    const search = page.getByRole("textbox", { name: "Buscar conversa" });
    // No accent, other case.
    await search.fill("CLINICA AURORA");
    await expect(page.getByRole("button", { name: new RegExp(OTHER.name) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(LEAD.name) })).toHaveCount(0);
    await expect(all).toContainText("1");
    await expect(page).toHaveURL(/q=CLINICA/);

    // By e-mail too; nothing found offers to clear.
    await search.fill("sorriso.test");
    await expect(page.getByRole("button", { name: new RegExp(LEAD.name) })).toBeVisible();
    await search.fill("padaria");
    await expect(page.getByText("Nenhuma conversa com “padaria”.")).toBeVisible();
    await expect(all).toContainText("0");
    await page.getByRole("button", { name: "Limpar busca" }).last().click();
    await expect(search).toHaveValue("");
    await expect(all).toContainText("2");
  });

  test("J and K walk the list, but not while typing", async ({ page, backend }) => {
    const [second] = tickTimes(1);
    const older = await startConversation(page, backend, OTHER);
    const newer = await startConversation(page, backend, LEAD, second);
    await visit(page, "/conversas");
    await expect(page.getByRole("button", { name: new RegExp(LEAD.name) })).toBeVisible();

    await page.keyboard.press("j");
    await expect(page).toHaveURL(new RegExp(`lead=${newer.id}`));
    await page.keyboard.press("j");
    await expect(page).toHaveURL(new RegExp(`lead=${older.id}`));
    await page.keyboard.press("k");
    await expect(page).toHaveURL(new RegExp(`lead=${newer.id}`));

    const reply = page.getByLabel("Sua resposta");
    await reply.click();
    await page.keyboard.type("jk");
    await expect(reply).toHaveValue("jk");
    await expect(page).toHaveURL(new RegExp(`lead=${newer.id}`));
  });

  test("Esc closes the conversation on a phone", async ({ page, backend }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { id } = await startConversation(page, backend);
    await visit(page, `/conversas?lead=${id}`);
    await expect(page.getByLabel("Sua resposta")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/lead=/);
    await expect(page.getByRole("button", { name: new RegExp(LEAD.name) })).toBeVisible();
  });

  test("WhatsApp opens from the conversation when the lead has a phone", async ({
    page,
    backend,
  }) => {
    const { id } = await startConversation(page, backend, { ...LEAD, phone: "(31) 99999-0000" });
    await visit(page, `/conversas?lead=${id}`);
    const whatsapp = page.getByRole("link", { name: /^WhatsApp/ });
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/5531999990000");
    await expect(whatsapp).toHaveAttribute("target", "_blank");

    const other = await startConversation(page, backend, OTHER, tickTimes(1)[0]);
    await visit(page, `/conversas?lead=${other.id}`);
    await expect(page.getByLabel("Sua resposta")).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
  });

  test("a reply shows only the new text until the quote is asked for", async ({
    page,
    backend,
  }) => {
    const [poll] = tickTimes(1);
    const { id, messageId, subject } = await startConversation(page, backend);
    await backend.inbound({
      from: LEAD.email,
      subject: `Re: ${subject}`,
      text: `Oi! Pode me contar mais sobre isso?\n\nEm seg., 12 de out. de 2026 às 10:00, Ana Teste <eu@nelcota.test> escreveu:\n\n> Olá, tudo bem? Texto para ${LEAD.name}.`,
      inReplyTo: messageId,
    });
    await backend.tick(poll);

    await visit(page, `/conversas?lead=${id}`);
    const reply = page.getByRole("article").filter({ hasText: "Pode me contar mais" });
    await expect(reply).not.toContainText("escreveu:");
    await expect(page.getByRole("button", { name: new RegExp(LEAD.name) })).not.toContainText(
      "escreveu:",
    );
    const toggle = reply.getByRole("button", { name: "Mostrar mensagem anterior" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(reply).toContainText("Ana Teste <eu@nelcota.test> escreveu:");
    await reply.getByRole("button", { name: "Ocultar" }).click();
    await expect(reply).not.toContainText("escreveu:");
    // What we sent is never cut.
    await expect(page.getByRole("article").first()).toContainText("Para não receber mais e-mails");
  });

  test("the AI writes or rewrites the reply, and Undo puts the text back", async ({
    page,
    backend,
  }) => {
    const { id } = await startConversation(page, backend);
    await visit(page, `/conversas?lead=${id}`);
    const reply = page.getByLabel("Sua resposta");

    await page.getByRole("button", { name: "Escrever com IA" }).click();
    await expect(reply).toHaveValue("Resposta da IA");
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(reply).toHaveValue("");

    await reply.fill("oi, posso te ligar?");
    await expect(page.getByText("Rascunho salvo")).toBeVisible();
    await page.getByRole("button", { name: "Reescrever" }).click();
    await expect(reply).toHaveValue("Resposta reescrita pela IA");
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(reply).toHaveValue("oi, posso te ligar?");
    await reload(page);
    await expect(page.getByLabel("Sua resposta")).toHaveValue("oi, posso te ligar?");

    // The AI's text is kept as the user's own draft.
    await page.getByRole("button", { name: "Reescrever" }).click();
    await expect(page.getByLabel("Sua resposta")).toHaveValue("Resposta reescrita pela IA");
    await reload(page);
    await expect(page.getByLabel("Sua resposta")).toHaveValue("Resposta reescrita pela IA");
    expect(await backend.sent()).toHaveLength(1);
  });

  test("a quick reply saved in Configurações goes in where the caret is", async ({
    page,
    backend,
  }) => {
    const { id } = await startConversation(page, backend);
    await visit(page, "/settings");
    await page.getByRole("button", { name: "Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo 1").fill("Ligação");
    await page.getByLabel("Texto do modelo 1").fill("Posso te ligar amanhã às 10h?");
    await page.getByRole("button", { name: "Salvar respostas rápidas" }).click();
    await expect(page.getByText("Respostas rápidas salvas")).toBeVisible();

    await visit(page, `/conversas?lead=${id}`);
    const reply = page.getByLabel("Sua resposta");
    await reply.fill("Oi!  Abraço.");
    await reply.press("Home");
    await reply.press("ArrowRight");
    await reply.press("ArrowRight");
    await reply.press("ArrowRight");
    await reply.press("ArrowRight");

    await page.getByRole("button", { name: "Modelos" }).click();
    await page.getByLabel("Filtrar modelos").fill("padaria");
    await expect(page.getByText("Nenhum modelo com “padaria”.")).toBeVisible();
    await page.getByLabel("Filtrar modelos").fill("LIGACAO");
    await page.getByRole("button", { name: /Ligação/ }).click();
    await expect(reply).toHaveValue("Oi! Posso te ligar amanhã às 10h? Abraço.");
    await expect(reply).toBeFocused();

    await expect(page.getByText("Rascunho salvo")).toBeVisible();
    await reload(page);
    await expect(page.getByLabel("Sua resposta")).toHaveValue(
      "Oi! Posso te ligar amanhã às 10h? Abraço.",
    );
  });
});
