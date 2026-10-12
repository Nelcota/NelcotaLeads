import { expect, test, visit } from "./fixtures";

const XSS_NAME = "<img src=x onerror=alert(1)>";
const XSS_SITE = "javascript:alert(1)";

test.describe("untrusted lead data", () => {
  test("renders a hostile name and website as plain text", async ({ page, backend }) => {
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const { id } = await backend.lead({
      name: XSS_NAME,
      website: XSS_SITE,
      email: "xss@evil.test",
    });

    await visit(page, "/leads?view=all");
    await expect(page.getByRole("table").getByText(XSS_NAME, { exact: true })).toBeVisible();

    // The lead panel, where the website is listed.
    await visit(page, `/leads?view=all&lead=${id}`);
    const panel = page.getByRole("dialog", { name: XSS_NAME });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(XSS_SITE, { exact: true })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Site" })).toHaveCount(0);

    for (const where of [page, panel]) {
      await expect(where.locator('a[href^="javascript:" i]')).toHaveCount(0);
      await expect(where.locator('img[src="x"]')).toHaveCount(0);
    }
    expect(dialogs).toEqual([]);
  });
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages redirect to the login screen", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/login\?next=%2Fleads$/);
    await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  });

  test("the CSV export answers 401", async ({ page }) => {
    const response = await page.request.get("/api/leads.csv");
    expect(response.status()).toBe(401);
    expect(await response.text()).not.toContain("nome;cidade");
  });

  test("a wrong password is refused", async ({ page, consoleErrors }) => {
    // The browser logs the refused login request (401) itself.
    consoleErrors.allow(/status of 401/);
    await visit(page, "/login");
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText("Senha incorreta.");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the eye button shows and hides the password", async ({ page }) => {
    await visit(page, "/login");
    const field = page.getByLabel("Senha", { exact: true });
    await field.fill("segredo-123");
    await expect(field).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(field).toHaveValue("segredo-123");
    await expect(field).toBeFocused();

    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(field).toHaveAttribute("type", "password");
  });
});
