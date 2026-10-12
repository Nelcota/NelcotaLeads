import type { Page } from "@playwright/test";
import { expect, test, tickTimes, visit } from "./fixtures";

const LEADS = [
  { name: "Clínica Alfa", email: "contato@alfa.test" },
  { name: "Clínica Beta", email: "contato@beta.test" },
  { name: "Clínica Gama", email: "contato@gama.test" },
];

function emailOf(name: string) {
  const lead = LEADS.find((item) => item.name === name);
  if (!lead) throw new Error(`unknown lead ${name}`);
  return lead.email;
}

/** The lead of the draft on screen, read from the AI's subject ("Assunto para <name>"). */
async function currentDraftLead(page: Page) {
  const sheet = page.getByRole("dialog");
  const subject = await sheet.getByLabel("Assunto").inputValue();
  const name = LEADS.map((lead) => lead.name).find((item) => subject.endsWith(item));
  if (!name) throw new Error(`unexpected subject ${subject}`);
  return name;
}

test.describe("e-mail dispatch", () => {
  test("reviews, edits, removes and sends each e-mail exactly once", async ({ page, backend }) => {
    for (const lead of LEADS) await backend.lead(lead);
    const [t1, t2, t3, t4, t5] = tickTimes(5);

    await visit(page, "/leads");
    await expect(page.getByText(/3\s+leads prontos para disparo/)).toBeVisible();
    await page.getByRole("button", { name: "Selecionar todos" }).click();
    await expect(page.getByText("3 selecionados")).toBeVisible();
    await page.getByRole("button", { name: "Disparar e-mail" }).click();

    const sheet = page.getByRole("dialog", { name: "Disparar 3 e-mails" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("1 de 3")).toBeVisible();

    // Edit the first draft.
    const edited = await currentDraftLead(page);
    await sheet.getByLabel("Assunto").fill("Proposta para a sua clínica");
    await sheet.getByLabel("Mensagem").fill("Olá! Texto revisado por mim.");

    // Drop the second one.
    await sheet.getByRole("button", { name: "Próximo" }).click();
    await expect(sheet.getByText("2 de 3")).toBeVisible();
    const removed = await currentDraftLead(page);
    expect(removed).not.toBe(edited);
    await sheet.getByRole("button", { name: "Tirar do disparo" }).click();

    const review = page.getByRole("dialog", { name: "Disparar 2 e-mails" });
    await expect(review.getByText("1 de 2")).toBeVisible();
    await expect(review.getByLabel("Assunto")).toHaveValue("Proposta para a sua clínica");
    await review.getByRole("button", { name: "Próximo" }).click();
    const untouched = await currentDraftLead(page);
    expect([edited, removed]).not.toContain(untouched);

    await review.getByRole("button", { name: "Disparar 2 e-mails" }).click();
    await expect(page.getByText("2 e-mails na fila")).toBeVisible();
    await expect(review).toBeHidden();

    // The first goes out right away, the rest one per tick; later ticks find nothing to send.
    expect(await backend.sent()).toHaveLength(1);
    await backend.tick(t1);
    expect(await backend.sent()).toHaveLength(2);
    await backend.tick(t2);
    await backend.tick(t3);
    const sent = await backend.sent();
    expect(sent).toHaveLength(2);
    expect(sent.map((email) => email.to)).toEqual(
      expect.arrayContaining([emailOf(edited), emailOf(untouched)]),
    );
    expect(sent.map((email) => email.to)).not.toContain(emailOf(removed));

    const editedEmail = sent.find((email) => email.to === emailOf(edited));
    expect(editedEmail?.subject).toBe("Proposta para a sua clínica");
    // The rewritten body goes out as typed, plus the mandatory opt-out line.
    expect(editedEmail?.text).toBe(
      `Olá! Texto revisado por mim.

Para não receber mais e-mails, responda com "sair".`,
    );
    const aiEmail = sent.find((email) => email.to === emailOf(untouched));
    expect(aiEmail?.subject).toBe(`Assunto para ${untouched}`);
    expect(aiEmail?.text).toContain(`Texto para ${untouched}.`);
    expect(aiEmail?.text).toContain("Ana Teste");
    expect(aiEmail?.text).toContain('responda com "sair"');

    // Selecting the contacted leads again offers nothing to send.
    await visit(page, "/leads?view=all");
    for (const name of [edited, untouched]) {
      await page.getByRole("checkbox", { name: `Selecionar ${name}` }).check();
    }
    await page.getByRole("button", { name: "Disparar e-mail" }).click();
    const again = page.getByRole("dialog", { name: "Disparar 0 e-mails" });
    await expect(again.getByText("Nenhum e-mail para revisar.")).toBeVisible();
    await expect(again.getByText(`${edited}: já recebeu e-mail`)).toBeVisible();
    await expect(again.getByText(`${untouched}: já recebeu e-mail`)).toBeVisible();
    await expect(again.getByRole("button", { name: /^Disparar 0 e-mails$/ })).toBeDisabled();

    await backend.tick(t4);
    await backend.tick(t5);
    expect(await backend.sent()).toHaveLength(2);
  });
});
