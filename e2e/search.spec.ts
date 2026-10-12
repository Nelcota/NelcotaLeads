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
