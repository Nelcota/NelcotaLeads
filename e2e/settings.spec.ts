import type { Page } from "@playwright/test";
import { expect, test, visit } from "./fixtures";

/**
 * Opens Configurações from the sidebar (client-side navigation). A server-rendered /settings
 * can fail hydration, see the fixme test below; these tests cover the settings themselves.
 */
async function openSettings(page: Page, tab: string) {
  await visit(page, "/");
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Seções de Configurações" })
    .getByRole("link", { name: tab })
    .click();
}

test.describe("settings", () => {
  test("rejects an invalid minimum score and keeps the saved one", async ({ page }) => {
    await openSettings(page, "IA e pontuação");
    const minScore = page.getByLabel("Descartar leads com nota abaixo de");
    await expect(minScore).toHaveValue("30");

    await minScore.fill("150");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    // The field error (no role or id to target it by).
    await expect(page.locator("p.text-destructive")).toContainText("100");
    await expect(page.getByText("Configurações salvas")).toHaveCount(0);

    await openSettings(page, "IA e pontuação");
    await expect(page.getByLabel("Descartar leads com nota abaixo de")).toHaveValue("30");
  });

  test("saves valid settings that survive a reload", async ({ page }) => {
    await openSettings(page, "IA e pontuação");
    await page.getByLabel("O que você oferece").fill("Landing pages para dentistas");
    await page.getByLabel("Descartar leads com nota abaixo de").fill("45");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();
    await expect(page.getByText("Oferta e critérios não salvos")).toBeHidden();

    await openSettings(page, "IA e pontuação");
    await expect(page.getByLabel("O que você oferece")).toHaveValue("Landing pages para dentistas");
    await expect(page.getByLabel("Descartar leads com nota abaixo de")).toHaveValue("45");
    // The sender profile is shown in E-mail e envio and edited in Conta only.
    await openSettings(page, "E-mail e envio");
    await expect(page.getByText("Ana Teste · Nelcota")).toBeVisible();
    await expect(page.getByLabel("Seu nome")).toHaveCount(0);
  });

  test("asks before leaving with unsaved changes, and keeps them", async ({ page }) => {
    await openSettings(page, "IA e pontuação");
    await page.getByLabel("O que você oferece").fill("Lojas virtuais");
    await page.getByRole("link", { name: "Leads", exact: true }).click();

    const ask = page.getByRole("alertdialog", { name: "Descartar alterações?" });
    await expect(ask).toBeVisible();
    await expect(ask.getByRole("button", { name: "Continuar editando" })).toBeFocused();
    await ask.getByRole("button", { name: "Continuar editando" }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
    await expect(page.getByLabel("O que você oferece")).toHaveValue("Lojas virtuais");

    // "Descartar" on the bar asks too, then puts the saved text back.
    await page.getByRole("button", { name: "Descartar", exact: true }).click();
    await ask.getByRole("button", { name: "Descartar" }).click();
    await expect(page.getByLabel("O que você oferece")).toHaveValue(
      "Sites e anúncios para clínicas",
    );

    // Nothing left to lose: leaving no longer asks.
    await page.getByRole("link", { name: "Leads", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Leads", level: 1 })).toBeVisible();
  });

  test("removing a niche can be undone", async ({ page }) => {
    await openSettings(page, "Automação");
    await page.getByRole("button", { name: "Adicionar nicho e cidade" }).click();
    await page.getByLabel("Nicho 1").fill("dentistas");
    await page.getByLabel("Cidade 1").fill("Belo Horizonte");
    await page.getByRole("button", { name: "Remover busca 1" }).click();
    await expect(page.getByLabel("Nicho 1")).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByLabel("Nicho 1")).toHaveValue("dentistas");
    await expect(page.getByLabel("Cidade 1")).toHaveValue("Belo Horizonte");
  });

  test("tests the mail connection without leaking secrets", async ({ page }) => {
    await openSettings(page, "E-mail e envio");
    await expect(page.getByText("eu@nelcota.test").first()).toBeVisible();
    await page.getByRole("button", { name: "Testar conexão" }).click();
    await expect(page.getByText("Conexão funcionando: envio e leitura.")).toBeVisible();
    const toasts = page.getByRole("region", { name: /Avisos/ });
    await expect(toasts).not.toContainText("fake");
    await expect(toasts).not.toContainText("MAIL_PASSWORD");
  });

  // Regression: the e-mail card renders provider status; when the loader didn't prefetch it,
  // a client fetch finishing before hydration caused "Hydration failed…" and lost typed input.
  test("a server-rendered /settings hydrates cleanly", async ({ page }) => {
    // Slow the CPU so the hydration of the route chunk is still running when the status
    // the sidebar fetched comes back.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
    await visit(page, "/settings?aba=email");
    await expect(page.getByRole("button", { name: "Testar conexão" })).toBeEnabled();
    // The auto `consoleErrors` fixture fails the test on React's hydration error.
  });
});
