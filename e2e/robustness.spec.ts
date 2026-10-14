import { expect, test, tickTimes, visit } from "./fixtures";

test.describe("bad links", () => {
  test("invalid URL params fall back to defaults instead of an error page", async ({
    page,
    backend,
  }) => {
    await backend.lead({ name: "Padaria Sol" });
    await visit(page, "/leads?view=foo&minScore=500&dir=sideways");
    await expect(page.getByRole("heading", { name: "Leads", level: 1 })).toBeVisible();
    await expect(page.getByText("Padaria Sol").filter({ visible: true }).first()).toBeVisible();

    await visit(page, `/conversas?filter=nope&q=${"x".repeat(300)}`);
    await expect(page.getByRole("heading", { name: "Conversas", level: 1 })).toBeVisible();

    await visit(page, "/searches?missing=maybe");
    await expect(page.getByRole("heading", { name: "Buscas", level: 1 })).toBeVisible();
  });
});

test.describe("queued e-mails", () => {
  test("a lead discarded after dispatch never gets its queued e-mail", async ({
    page,
    backend,
  }) => {
    await backend.lead({ name: "Clínica Alfa", email: "contato@alfa.test" });
    await backend.lead({ name: "Clínica Beta", email: "contato@beta.test" });
    const [t1, t2] = tickTimes(2);

    await visit(page, "/leads");
    await page.getByRole("button", { name: "Selecionar todos" }).click();
    await page.getByRole("button", { name: "Disparar e-mail" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disparar 2 e-mails" }).click();
    await expect(page.getByText("2 e-mails na fila")).toBeVisible();

    // The first goes out at once; the other waits for its slot.
    const [first] = await backend.sent();
    const waiting = first?.to === "contato@alfa.test" ? "Clínica Beta" : "Clínica Alfa";
    await page.getByRole("checkbox", { name: `Selecionar ${waiting}` }).check();
    await page.getByRole("button", { name: "Mais ações para a seleção" }).click();
    await page.getByRole("menuitem", { name: "Descartar" }).click();
    await expect(page.getByText(/descartado/)).toBeVisible();

    await backend.tick(t1);
    await backend.tick(t2);
    expect(await backend.sent()).toHaveLength(1);
  });
});

test.describe("browser defaults", () => {
  test("controls look like the app, not the browser", async ({ page, backend }) => {
    // With no leads the list shows an empty state without the search box.
    await backend.lead({ name: "Padaria Sol" });
    await visit(page, "/conversas");
    const html = page.locator("html");
    await expect(html).toHaveCSS("-webkit-tap-highlight-color", "rgba(0, 0, 0, 0)");

    // Tailwind's preflight leaves buttons with the arrow cursor.
    await expect(page.getByRole("button", { name: "Verificar e-mails" })).toHaveCSS(
      "cursor",
      "pointer",
    );
    // App search boxes don't get Chrome's remembered-values dropdown.
    await expect(page.getByLabel("Buscar conversa")).toHaveAttribute("autocomplete", "off");

    await visit(page, "/leads");
    await expect(page.getByLabel("Buscar empresa")).toHaveAttribute("autocomplete", "off");

    const resize = await page.evaluate(() => {
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      const value = getComputedStyle(textarea).resize;
      textarea.remove();
      return value;
    });
    expect(resize).toBe("none");
  });
});
