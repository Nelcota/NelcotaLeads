import type { Page } from "@playwright/test";
import { expect, test, visit } from "./fixtures";

/**
 * Opens Configurações from the sidebar (client-side navigation). A server-rendered /settings
 * can fail hydration, see the fixme test below; these tests cover the settings themselves.
 */
async function openSettings(page: Page) {
  await visit(page, "/");
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(page.getByRole("heading", { name: "Configurações", level: 1 })).toBeVisible();
}

test.describe("settings", () => {
  test("rejects an invalid minimum score and keeps the saved one", async ({ page }) => {
    await openSettings(page);
    const minScore = page.getByLabel("Descartar leads com nota abaixo de");
    await expect(minScore).toHaveValue("30");

    await minScore.fill("150");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    // The field error (no role or id to target it by).
    await expect(page.locator("p.text-destructive")).toContainText("100");
    await expect(page.getByText("Configurações salvas")).toHaveCount(0);

    await openSettings(page);
    await expect(page.getByLabel("Descartar leads com nota abaixo de")).toHaveValue("30");
  });

  test("saves valid settings that survive a reload", async ({ page }) => {
    await openSettings(page);
    await page.getByLabel("O que você oferece").fill("Landing pages para dentistas");
    await page.getByLabel("Descartar leads com nota abaixo de").fill("45");
    await page.getByLabel("Seu nome").fill("Bruno Teste");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();
    await expect(page.getByText("Alterações não salvas")).toBeHidden();

    await openSettings(page);
    await expect(page.getByLabel("O que você oferece")).toHaveValue("Landing pages para dentistas");
    await expect(page.getByLabel("Descartar leads com nota abaixo de")).toHaveValue("45");
    await expect(page.getByLabel("Seu nome")).toHaveValue("Bruno Teste");
    await expect(page.getByLabel("Sua empresa")).toHaveValue("Nelcota");
  });

  test("tests the mail connection without leaking secrets", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByText("eu@nelcota.test").first()).toBeVisible();
    await page.getByRole("button", { name: "Testar conexão" }).click();
    await expect(page.getByText("Conexão funcionando: envio e leitura.")).toBeVisible();
    const toasts = page.getByRole("region", { name: /Notifications/ });
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
    await visit(page, "/settings");
    await expect(page.getByRole("button", { name: "Testar conexão" })).toBeEnabled();
    // The auto `consoleErrors` fixture fails the test on React's hydration error.
  });
});
