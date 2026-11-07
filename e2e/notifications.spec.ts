import { expect, openNewSearch, reload, test, visit } from "./fixtures";

test("a completed search appears in the bell and can be cleared and restored", async ({ page }) => {
  await visit(page, "/");
  const bell = page.getByRole("button", { name: "Notificações", exact: true });
  await expect(bell).toBeVisible();

  const dialog = await openNewSearch(page);
  await dialog.getByLabel("Nicho").fill("dentistas");
  await dialog.getByLabel("Cidade").fill("Belo Horizonte");
  await dialog.getByRole("button", { name: "Buscar empresas" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/em análise/)).toHaveCount(0, { timeout: 45_000 });
  await reload(page);

  await expect(page.getByRole("button", { name: /Notificações, 1 não lidas/ })).toBeVisible();
  await page.getByRole("button", { name: /Notificações, 1 não lidas/ }).click();
  const panel = page.locator("[data-notification-panel]");
  await expect(panel.getByRole("link", { name: /Dentistas em Belo Horizonte/ })).toBeVisible();

  await panel.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(panel.getByText("Nada novo por aqui")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(panel.getByRole("link", { name: /Dentistas em Belo Horizonte/ })).toBeVisible();
});
