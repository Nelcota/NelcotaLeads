import type { Page } from "@playwright/test";
import { E2E_ACCOUNT, expect, hydrated, serverFnName, test, visit } from "./fixtures";

function sidebar(page: Page) {
  return page.locator('[data-sidebar="sidebar"]');
}

function workspaceButton(page: Page) {
  return sidebar(page).getByRole("button", { name: /Nelcota Leads/ });
}

function statusCard(page: Page) {
  return page.getByRole("region", { name: "Situação de hoje" });
}

test.describe("sidebar status card", () => {
  test("shows today's usage when nothing is wrong", async ({ page }) => {
    await visit(page, "/");
    await expect(statusCard(page).getByRole("group", { name: /e-mails hoje$/ })).toBeVisible();
    await expect(workspaceButton(page)).toContainText("Tudo funcionando");
  });

  test("says when the status cannot be read, and tries again", async ({ page, consoleErrors }) => {
    // The refused status request is logged by the browser itself.
    consoleErrors.allow(/status of 500/);
    const refuse = /\/_serverFn\//;
    await page.route(refuse, (route) => {
      if (serverFnName(route.request().url()) !== "getProviderStatus") return route.fallback();
      return route.fulfill({ status: 500, body: "falha simulada" });
    });
    await visit(page, "/");
    const card = statusCard(page);
    // React Query retries three times before giving up.
    await expect(card.getByText("Situação indisponível")).toBeVisible({ timeout: 15_000 });
    await expect(workspaceButton(page)).toContainText("Situação indisponível");
    await expect(page.getByTestId("system-attention")).toHaveCount(0);

    await page.unroute(refuse);
    await card.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(card.getByRole("group", { name: /e-mails hoje$/ })).toBeVisible();
  });
});

test.describe("sidebar account menu", () => {
  test("marks the menu on top while Conta is open", async ({ page }) => {
    await visit(page, "/conta");
    await expect(workspaceButton(page)).toHaveAttribute("aria-current", "page");
    await expect(sidebar(page).locator('a[aria-current="page"]')).toHaveCount(0);

    await sidebar(page).getByRole("link", { name: "Leads", exact: true }).click();
    await expect(workspaceButton(page)).not.toHaveAttribute("aria-current");
  });

  test("switches the theme", async ({ page }) => {
    await visit(page, "/");
    const html = page.locator("html");
    const startsDark = await html.evaluate((element) => element.classList.contains("dark"));

    await workspaceButton(page).click();
    await page.getByRole("menuitem", { name: startsDark ? "Tema claro" : "Tema escuro" }).click();
    if (startsDark) {
      await expect(html).not.toHaveClass(/\bdark\b/);
      return;
    }
    await expect(html).toHaveClass(/\bdark\b/);
  });

  test("the Menu button in the page header folds the sidebar on desktop", async ({ page }) => {
    await visit(page, "/");
    const frame = page.locator('[data-slot="sidebar"][data-state]');
    await expect(frame).toHaveAttribute("data-state", "expanded");
    const toggle = page.getByRole("button", { name: "Mostrar ou esconder o menu" });
    await toggle.click();
    await expect(frame).toHaveAttribute("data-state", "collapsed");
    await toggle.click();
    await expect(frame).toHaveAttribute("data-state", "expanded");
  });
});

test.describe("sidebar sign out", () => {
  // A session of its own: signing out must not end the one the other tests share.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Sair in the menu ends the session", async ({ page }) => {
    await visit(page, "/login");
    await page.getByLabel("E-mail").fill(E2E_ACCOUNT.email);
    await page.getByLabel("Senha", { exact: true }).fill(E2E_ACCOUNT.password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveTitle("Visão geral · Nelcota Leads");
    await hydrated(page);

    await workspaceButton(page).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
    await visit(page, "/");
    await expect(page).toHaveURL(/\/login/);
  });
});
