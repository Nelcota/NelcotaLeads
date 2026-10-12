import type { Page } from "@playwright/test";
import { expect, test, visit } from "./fixtures";

async function searchDentists(page: Page) {
  await page.getByRole("button", { name: "Nova busca" }).click();
  const dialog = page.getByRole("dialog", { name: "Busca manual" });
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
    await expect(page.getByText("Google Places respondeu 500: falha simulada")).toBeVisible();

    // The fault was one-shot: the app keeps working.
    await searchDentists(page);
    await expect(page.getByRole("table").getByText("Empresa 1", { exact: true })).toBeVisible();
  });

  test("an AI draft failure leaves that lead out and sends the rest", async ({ page, backend }) => {
    await backend.lead({ name: "Clínica Norte", email: "contato@norte.test" });
    await backend.lead({ name: "Clínica Sul", email: "contato@sul.test" });
    await backend.fault("writeEmail");

    await visit(page, "/leads");
    await page.getByRole("button", { name: "Selecionar todos" }).click();
    await page.getByRole("button", { name: "Disparar e-mail" }).click();

    const sheet = page.getByRole("dialog", { name: "Disparar 1 e-mail" });
    await expect(sheet.getByText("Ficaram de fora")).toBeVisible();
    await expect(
      sheet.getByText(/^Clínica (Norte|Sul): a IA não conseguiu escrever agora$/),
    ).toHaveCount(1);
    await sheet.getByRole("button", { name: "Disparar 1 e-mail" }).click();
    await expect(page.getByText("1 e-mail na fila")).toBeVisible();

    const sent = await backend.sent();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toMatch(/^Assunto para Clínica (Norte|Sul)$/);

    // The skipped lead can be retried right away.
    await page.getByRole("button", { name: "Selecionar", exact: true }).click();
    await page.getByRole("button", { name: "Disparar e-mail" }).click();
    const retry = page.getByRole("dialog", { name: "Disparar 1 e-mail" });
    await expect(retry.getByLabel("Assunto")).toHaveValue(/^Assunto para Clínica (Norte|Sul)$/);
    await expect(retry.getByText("Ficaram de fora")).toHaveCount(0);
  });
});
