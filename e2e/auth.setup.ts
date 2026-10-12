import { expect, test as setup } from "@playwright/test";
import { E2E_ACCOUNT } from "./fixtures";

/** Signs in once; every other test reuses the session cookie. */
setup("sign in", async ({ page }) => {
  // The E2E database keeps accounts between runs (resets only clear app data), so the account
  // may already exist: 409 is as good as 200 here.
  const signUp = await page.request.post("/api/signup", {
    headers: { Accept: "application/json" },
    data: { ...E2E_ACCOUNT, accessCode: "e2e-password" },
  });
  expect([200, 409]).toContain(signUp.status());
  await page.context().clearCookies();

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("E-mail").fill(E2E_ACCOUNT.email);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_ACCOUNT.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
