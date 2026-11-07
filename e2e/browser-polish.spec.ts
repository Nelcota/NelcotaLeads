import type { Page } from "@playwright/test";
import { E2E_ACCOUNT, expect, test, visit } from "./fixtures";

function rowOf(page: Page, name: string) {
  return page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
}

test.describe("browser chrome", () => {
  test("each page names its tab", async ({ page }) => {
    await visit(page, "/");
    await expect(page).toHaveTitle("Visão geral · Nelcota Leads");
    const pages = [
      ["Leads", "Leads · Nelcota Leads"],
      ["Conversas", "Conversas · Nelcota Leads"],
      ["Buscas", "Buscas · Nelcota Leads"],
      ["Conta", "Conta · Nelcota Leads"],
      ["Configurações", "Configurações · Nelcota Leads"],
    ] as const;
    for (const [link, title] of pages) {
      await page.getByRole("link", { name: link, exact: true }).click();
      await expect(page).toHaveTitle(title);
    }
  });

  test("icon buttons show the app tooltip on hover and focus", async ({ page }) => {
    await visit(page, "/conversas");
    // The flag-enabled bell mounts after hydration and shifts the adjacent action button.
    await expect(page.getByRole("button", { name: /^Notificações/ })).toBeVisible();
    const check = page.getByRole("button", { name: "Verificar e-mails" });
    await expect(check).not.toHaveAttribute("title");

    await check.hover();
    await expect(page.getByRole("tooltip")).toHaveText("Verificar e-mails");
    // Away from the button and its tooltip, in steps, as a real pointer moves.
    await page.mouse.move(600, 600, { steps: 5 });
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await check.focus();
    await expect(page.getByRole("tooltip")).toHaveText("Verificar e-mails");
  });

  test("the mobile menu button has the app tooltip", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await visit(page, "/");
    await page.getByRole("button", { name: "Mostrar ou esconder o menu" }).focus();
    await expect(page.getByRole("tooltip")).toHaveText("Menu");
  });

  test("links that open a new tab say so", async ({ page, backend }) => {
    const { id } = await backend.lead({ name: "Clínica Norte", website: "https://norte.test" });
    await visit(page, `/leads?view=all&lead=${id}`);
    const panel = page.getByRole("dialog", { name: "Clínica Norte" });
    const site = panel.getByRole("link", { name: "norte.test (abre em nova aba)" });
    await expect(site).toHaveAttribute("target", "_blank");
    await expect(site).toHaveAttribute("rel", "noopener noreferrer");
  });
});

test.describe("lead search", () => {
  test("clears with the button and with Esc", async ({ page, backend }) => {
    await backend.lead({ name: "Padaria Sol" });
    await backend.lead({ name: "Padaria Lua" });
    await visit(page, "/leads?view=all");
    const search = page.getByLabel("Buscar empresa");
    const clear = page.getByRole("button", { name: "Limpar busca" });
    await expect(clear).toBeHidden();

    await search.fill("Sol");
    await expect(page).toHaveURL(/[?&]q=Sol/);
    await expect(rowOf(page, "Padaria Lua")).toHaveCount(0);
    await clear.click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await expect(clear).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(rowOf(page, "Padaria Lua")).toBeVisible();

    await search.fill("Lua");
    await expect(page).toHaveURL(/[?&]q=Lua/);
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(rowOf(page, "Padaria Sol")).toBeVisible();
  });
});

test.describe("number steppers", () => {
  test("step by 5 and stop at the limits", async ({ page }) => {
    // Client-side navigation, like settings.spec.ts.
    await visit(page, "/");
    await page.getByRole("link", { name: "Configurações" }).click();

    const minScore = page.getByLabel("Descartar leads com nota abaixo de");
    const scoreStepper = page.locator('[data-slot="number-stepper"]').filter({ has: minScore });
    await expect(minScore).toHaveValue("30");
    await scoreStepper.getByRole("button", { name: "Aumentar" }).click();
    await expect(minScore).toHaveValue("35");
    await expect(page.getByText("Oferta e critérios não salvos")).toBeVisible();
    await scoreStepper.getByRole("button", { name: "Diminuir" }).click();
    await expect(minScore).toHaveValue("30");

    await minScore.fill("98");
    await scoreStepper.getByRole("button", { name: "Aumentar" }).click();
    await expect(minScore).toHaveValue("100");
    await expect(scoreStepper.getByRole("button", { name: "Aumentar" })).toBeDisabled();
    await minScore.fill("0");
    await expect(scoreStepper.getByRole("button", { name: "Diminuir" })).toBeDisabled();

    // Weights go negative, down to -100.
    const weight = page.getByLabel("Peso 1");
    const weightStepper = page.locator('[data-slot="number-stepper"]').filter({ has: weight });
    await weight.fill("0");
    await weightStepper.getByRole("button", { name: "Diminuir" }).click();
    await expect(weight).toHaveValue("-5");
    await weight.fill("-100");
    await expect(weightStepper.getByRole("button", { name: "Diminuir" })).toBeDisabled();
    await weightStepper.getByRole("button", { name: "Aumentar" }).click();
    await expect(weight).toHaveValue("-95");
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the login warns about Caps Lock without hiding an error", async ({
    page,
    consoleErrors,
  }) => {
    // The browser logs the refused login request (401) itself.
    consoleErrors.allow(/status of 401/);
    await visit(page, "/login");
    await expect(page).toHaveTitle("Entrar · Nelcota Leads");
    const password = page.getByLabel("Senha", { exact: true });
    const alert = page.getByRole("alert");

    // Synthetic events: headless Chromium doesn't toggle the real Caps Lock state.
    await password.dispatchEvent("keydown", { key: "A", modifierCapsLock: true });
    await expect(alert).toHaveText("Caps Lock ativado.");
    await password.dispatchEvent("keyup", { key: "a", modifierCapsLock: false });
    await expect(page.getByText("Caps Lock ativado.")).toBeHidden();

    await page.getByLabel("E-mail").fill(E2E_ACCOUNT.email);
    await password.fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(alert).toHaveText("E-mail ou senha incorretos.");
    await password.dispatchEvent("keydown", { key: "A", modifierCapsLock: true });
    await expect(alert).toHaveText("E-mail ou senha incorretos.");
  });

  test("the app icons and manifest load without a session", async ({ page }) => {
    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect(await manifest.json()).toMatchObject({
      short_name: "Nelcota",
      display: "standalone",
    });
    for (const icon of ["/apple-touch-icon.png", "/icon-192.png", "/icon-512.png"]) {
      const response = await page.request.get(icon);
      expect(response.status(), icon).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });
});
