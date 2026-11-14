import { E2E_ACCOUNT, expect, test, visit } from "./fixtures";

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
    await page.getByLabel("E-mail").fill(E2E_ACCOUNT.email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("empty fields are flagged inline without calling the server", async ({ page }) => {
    await visit(page, "/login");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("Informe o e-mail.")).toBeVisible();
    await expect(page.getByText("Informe a senha.")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeFocused();
  });

  test("an account can be created with the access code", async ({ page, consoleErrors }) => {
    consoleErrors.allow(/status of 401/);
    const email = `nova-${Date.now()}@nelcota.test`;
    await visit(page, "/login");
    await page.getByRole("link", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/criar-conta$/);

    await page.getByLabel("Nome").fill("Pessoa Nova");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-da-pessoa");
    const code = page.getByLabel("Código de acesso");
    await code.fill("codigo-errado");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Código de acesso incorreto.")).toBeVisible();
    await expect(code).toBeFocused();

    await code.fill("e2e-password");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL("/");

    await visit(page, "/conta");
    // The sidebar shows the e-mail too, and Conta shows it twice; check one exact match on the page.
    await expect(page.locator("#conteudo").getByText(email, { exact: true })).toBeVisible();
  });

  test("an e-mail that already has an account is refused", async ({ page, consoleErrors }) => {
    consoleErrors.allow(/status of 409/);
    await visit(page, "/criar-conta");
    await page.getByLabel("Nome").fill("Outra pessoa");
    await page.getByLabel("E-mail").fill(E2E_ACCOUNT.email);
    await page.getByLabel("Senha", { exact: true }).fill("outra-senha-123");
    await page.getByLabel("Código de acesso").fill("e2e-password");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Já existe uma conta com esse e-mail.")).toBeVisible();
  });

  test("a password can be reset through the e-mailed link", async ({ page, backend }) => {
    // Its own account: a reset signs the account out everywhere, the shared session included.
    const email = `reset-${Date.now()}@nelcota.test`;
    const created = await page.request.post("/api/signup", {
      headers: { Accept: "application/json" },
      data: { name: "Reset", email, password: "senha-antiga-1", accessCode: "e2e-password" },
    });
    expect(created.status()).toBe(200);
    await page.context().clearCookies();

    await visit(page, "/login");
    await page.getByRole("link", { name: "Esqueceu a senha?" }).click();
    await expect(page).toHaveURL(/\/redefinir-senha$/);
    await page.getByLabel("E-mail da conta").fill(email);
    await page.getByRole("button", { name: "Enviar link" }).click();
    await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");

    // Sent in the background, after the page already got its answer.
    await expect.poll(async () => (await backend.sent()).some((m) => m.to === email)).toBe(true);
    const mail = (await backend.sent()).find((m) => m.to === email);
    const link = /https?:\/\/\S+\/redefinir-senha\?token=\S+/.exec(mail?.text ?? "")?.[0];
    expect(link).toBeTruthy();

    await visit(page, new URL(link ?? "").pathname + new URL(link ?? "").search);
    await page.getByLabel("Nova senha").fill("senha-nova-123");
    await page.getByRole("button", { name: "Salvar senha e entrar" }).click();
    await expect(page).toHaveURL("/");

    await page.context().clearCookies();
    await visit(page, "/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill("senha-nova-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL("/");
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
    // The caret stays where it was instead of jumping to the start.
    await expect
      .poll(() => field.evaluate((input: HTMLInputElement) => input.selectionStart))
      .toBe(11);
    await page.keyboard.type("4");
    await expect(field).toHaveValue("segredo-1234");

    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(field).toHaveAttribute("type", "password");
    await expect
      .poll(() => field.evaluate((input: HTMLInputElement) => input.selectionStart))
      .toBe(12);
    await page.keyboard.type("5");
    await expect(field).toHaveValue("segredo-12345");
  });
});
