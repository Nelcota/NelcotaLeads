import { expect, test as setup } from "@playwright/test";

/** Signs in once; every other test reuses the session cookie. */
setup("sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Senha", { exact: true }).fill("e2e-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
