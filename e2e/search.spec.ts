import type { Page } from "@playwright/test";
import { expect, test, visit } from "./fixtures";

function rowOf(page: Page, name: string) {
  return page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
}

async function runSearch(page: Page) {
  await page.getByRole("button", { name: "Nova busca" }).click();
  const dialog = page.getByRole("dialog", { name: "Busca manual" });
  await dialog.getByLabel("Nicho").fill("dentistas");
  await dialog.getByLabel("Cidade").fill("Belo Horizonte");
  await expect(dialog.getByRole("tab", { name: "até 20" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await dialog.getByRole("button", { name: "Buscar empresas" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/leads\?.*searchId=/);
}

/** Waits until the queue analyzed every lead of the list on screen. */
async function waitForAnalysis(page: Page) {
  await expect(page.getByText(/em análise/)).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByText("analisando")).toHaveCount(0);
}

test.describe("manual search", () => {
  test("finds, analyzes and triages leads without duplicating them", async ({ page }) => {
    await visit(page, "/");
    await runSearch(page);

    // All 20 places come in; the analysis runs in the background through the queue.
    const table = page.getByRole("table");
    await expect(table.getByText("Empresa 20", { exact: true })).toBeVisible();
    await waitForAnalysis(page);

    // Odd ones score 80 and stay; even ones score 10 and the AI discards them.
    const odd = rowOf(page, "Empresa 1");
    await expect(odd).toContainText("80");
    await expect(odd).toContainText("Novo");
    const even = rowOf(page, "Empresa 2");
    await expect(even).toContainText("10");
    await expect(even).toContainText("Descartado");

    // The default view ("A contatar") only lists the leads that passed the minimum score.
    await visit(page, "/leads");
    await expect(page.getByRole("tab", { name: /A contatar/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    for (const n of [1, 3, 19]) {
      await expect(table.getByText(`Empresa ${n}`, { exact: true })).toBeVisible();
    }
    for (const n of [2, 4, 20]) {
      await expect(table.getByText(`Empresa ${n}`, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole("checkbox", { name: /^Selecionar Empresa/ })).toHaveCount(10);
    await expect(page.getByRole("tab", { name: /Todos/ })).toContainText("20");

    // Same places again: nothing new is created.
    await runSearch(page);
    await visit(page, "/searches");
    await expect(page.getByText(/20\s+já existiam/)).toBeVisible();
    await visit(page, "/leads?view=all");
    await expect(page.getByRole("tab", { name: /Todos/ })).toContainText("20");
    await expect(page.getByRole("checkbox", { name: /^Selecionar Empresa/ })).toHaveCount(20);
    await expect(table.getByText("Empresa 1", { exact: true })).toHaveCount(1);
  });
});

test.describe("search card actions", () => {
  test("a failed search offers to try again, and the new one runs", async ({ page, backend }) => {
    await backend.fault("places");
    await visit(page, "/");
    await page.getByRole("button", { name: "Nova busca" }).click();
    const dialog = page.getByRole("dialog", { name: "Busca manual" });
    await dialog.getByLabel("Nicho").fill("dentistas");
    await dialog.getByLabel("Cidade").fill("Belo Horizonte");
    await dialog.getByRole("button", { name: "Buscar empresas" }).click();
    await expect(dialog).toBeHidden();

    await visit(page, "/searches");
    await expect(page.getByText("Falhou")).toBeVisible();
    // A failed search with no leads is not a link to them.
    await expect(page.getByRole("link", { name: /Ver leads: dentistas/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Tentar de novo" }).click();

    await expect(page.getByText("Busca feita de novo")).toBeVisible();
    const retried = page.getByRole("link", { name: "Ver leads: dentistas em Belo Horizonte" });
    await expect(retried).toHaveCount(1);
    await retried.click();
    await expect(page).toHaveURL(/\/leads\?.*searchId=/);
    await expect(page.getByRole("table").getByText("Empresa 20", { exact: true })).toBeVisible();
  });

  test("cancels a running search and keeps what it collected", async ({ page, backend }) => {
    await backend.runningSearch({ niche: "padarias", city: "Contagem", leads: 3 });
    await visit(page, "/searches");
    await expect(page.getByText("Analisando").first()).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(page.getByText("Busca cancelada")).toBeVisible();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

    // The leads stay, set aside without an analysis.
    await page.getByRole("link", { name: "Ver leads: padarias em Contagem" }).click();
    const table = page.getByRole("table");
    await expect(table.getByText("padarias 1", { exact: true })).toBeVisible();
    await expect(table.getByText("Não analisado").first()).toBeVisible();
  });

  test("hides a search with undo", async ({ page, backend }) => {
    await backend.runningSearch({ niche: "padarias", city: "Contagem", leads: 1 });
    await visit(page, "/searches");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Ocultar" }).click();
    await expect(page.getByText("Nenhuma busca ainda")).toBeVisible();
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByRole("link", { name: "Ver leads: padarias em Contagem" })).toBeVisible();
  });
});
