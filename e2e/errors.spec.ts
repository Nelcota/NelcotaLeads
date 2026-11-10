import type { Page } from "@playwright/test";
import { expect, openNewSearch, reload, test, tickTimes, visit } from "./fixtures";

async function searchDentists(page: Page) {
  const dialog = await openNewSearch(page);
  await dialog.getByLabel("Nicho").fill("dentistas");
  await dialog.getByLabel("Cidade").fill("Belo Horizonte");
  await dialog.getByRole("button", { name: "Buscar empresas" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("provider failures", () => {
  test("a failing Places search shows as failed and the next one works", async ({
    page,
    backend,
  }) => {
    await backend.fault("places");
    await visit(page, "/");
    await searchDentists(page);

    // Not a blank screen: the leads page with an empty result.
    await expect(page.getByRole("heading", { name: "Leads", level: 1 })).toBeVisible();
    await expect(
      page.getByText("Nenhum lead com esses filtros.").filter({ visible: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Buscas" }).click();
    await expect(page.getByText("Falhou")).toBeVisible();
    // A fixed sentence, never Google's own response text.
    await expect(
      page.getByText("O Google não respondeu à busca. Tente de novo em alguns minutos.").first(),
    ).toBeVisible();
    await expect(page.getByText(/Google Places respondeu|falha simulada/)).toHaveCount(0);

    // The fault was one-shot: the app keeps working.
    await searchDentists(page);
    await expect(page.getByRole("table").getByText("Empresa 1", { exact: true })).toBeVisible();
  });

  test("an AI draft failure leaves that lead out and sends the rest", async ({ page, backend }) => {
    await backend.lead({ name: "Clínica Norte", email: "contato@norte.test" });
    await backend.lead({ name: "Clínica Sul", email: "contato@sul.test" });
    await backend.fault("writeEmail");

    await visit(page, "/leads");
    await page.getByRole("button", { name: "Selecionar prontos (2)" }).click();
    await page
      .getByRole("region", { name: "Ações da seleção" })
      .getByRole("button", { name: "Disparar" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Escrever 2 e-mails" }).click();

    const sheet = page.getByRole("dialog", { name: "Disparar 1 e-mail" });
    await expect(sheet.getByText("Ficaram de fora")).toBeVisible();
    await expect(
      sheet.getByText(/^Clínica (Norte|Sul): a IA não conseguiu escrever agora$/),
    ).toHaveCount(1);
    await sheet.getByRole("button", { name: "Disparar 1 e-mail" }).click();
    await expect(page.getByText("1 e-mail na fila")).toBeVisible();
    // Out right away inside the send window; otherwise on a tick within it.
    await backend.tick(tickTimes(1)[0] ?? new Date());

    const sent = await backend.sent();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toMatch(/^Assunto para Clínica (Norte|Sul)$/);

    // The skipped lead can be retried right away (reloaded: the tick sent the other one).
    await reload(page);
    await page.getByRole("button", { name: "Selecionar prontos (1)" }).click();
    await page
      .getByRole("region", { name: "Ações da seleção" })
      .getByRole("button", { name: "Disparar" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Escrever 1 e-mail" }).click();
    const retry = page.getByRole("dialog", { name: "Disparar 1 e-mail" });
    await expect(retry.getByLabel("Assunto")).toHaveValue(/^Assunto para Clínica (Norte|Sul)$/);
    await expect(retry.getByText("Ficaram de fora")).toHaveCount(0);
  });
});
