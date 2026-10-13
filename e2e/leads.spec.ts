import type { Page } from "@playwright/test";
import { expect, reload, serverFnName, test, visit } from "./fixtures";

function rowOf(page: Page, name: string) {
  return page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
}

/** Resolves when the next lead update answers. */
function nextLeadUpdate(page: Page) {
  return page.waitForResponse((response) => serverFnName(response.url()) === "updateLead");
}

test.describe("leads inbox", () => {
  test("filters by status and persists notes and status edits", async ({ page, backend }) => {
    await backend.lead({ name: "Padaria Sol" });
    await backend.lead({ name: "Padaria Lua" });

    await visit(page, "/leads?view=all");
    await expect(rowOf(page, "Padaria Sol")).toContainText("Novo");
    await expect(rowOf(page, "Padaria Lua")).toContainText("Novo");

    await rowOf(page, "Padaria Sol").getByText("Padaria Sol", { exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Padaria Sol" });
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/[?&]lead=/);

    // Notes save when the field loses focus.
    const notes = panel.getByLabel("Notas");
    await notes.fill("Ligar depois das 14h");
    const notesSaved = nextLeadUpdate(page);
    await notes.blur();
    expect((await notesSaved).ok()).toBe(true);

    const statusSaved = nextLeadUpdate(page);
    await panel.getByRole("combobox", { name: "Status do lead" }).click();
    await page.getByRole("option", { name: "Descartado" }).click();
    expect((await statusSaved).ok()).toBe(true);
    await expect(panel.getByRole("combobox", { name: "Status do lead" })).toHaveText("Descartado");

    // The panel reopens from the URL with the saved values.
    await reload(page);
    const reopened = page.getByRole("dialog", { name: "Padaria Sol" });
    await expect(reopened.getByLabel("Notas")).toHaveValue("Ligar depois das 14h");
    await expect(reopened.getByRole("combobox", { name: "Status do lead" })).toHaveText(
      "Descartado",
    );
    await page.keyboard.press("Escape");
    await expect(reopened).toBeHidden();
    await expect(rowOf(page, "Padaria Sol")).toContainText("Descartado");
    await expect(rowOf(page, "Padaria Lua")).toContainText("Novo");

    // Status queues.
    await page.getByRole("tab", { name: /Descartados/ }).click();
    await expect(rowOf(page, "Padaria Sol")).toBeVisible();
    await expect(rowOf(page, "Padaria Lua")).toHaveCount(0);

    await page.getByRole("tab", { name: /A contatar/ }).click();
    await expect(rowOf(page, "Padaria Lua")).toBeVisible();
    await expect(rowOf(page, "Padaria Sol")).toHaveCount(0);
  });

  test("closing the panel with an edited WhatsApp message asks first", async ({
    page,
    backend,
  }) => {
    const { id } = await backend.lead({ name: "Padaria Sol" });
    await visit(page, `/leads?view=all&lead=${id}`);
    const panel = page.getByRole("dialog", { name: "Padaria Sol" });
    await panel.getByLabel("Mensagem de primeiro contato").fill("Oi! Vi a padaria no Google.");

    await page.keyboard.press("Escape");
    const ask = page.getByRole("alertdialog", { name: "Descartar alterações?" });
    await expect(ask).toBeVisible();
    // Keeping on editing is the default.
    await expect(ask.getByRole("button", { name: "Continuar editando" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(ask).toBeHidden();
    await expect(panel.getByLabel("Mensagem de primeiro contato")).toHaveValue(
      "Oi! Vi a padaria no Google.",
    );

    await page.keyboard.press("Escape");
    await ask.getByRole("button", { name: "Descartar" }).click();
    await expect(panel).toBeHidden();
  });
});

test.describe("leads actions", () => {
  test("discards three selected leads and undoes it", async ({ page, backend }) => {
    for (const name of ["Padaria Sol", "Padaria Lua", "Padaria Mar", "Padaria Céu"]) {
      await backend.lead({ name });
    }
    await visit(page, "/leads");
    for (const name of ["Padaria Sol", "Padaria Lua", "Padaria Mar"]) {
      await page.getByRole("checkbox", { name: `Selecionar ${name}` }).check();
    }
    await expect(page.getByText("3 selecionados")).toBeVisible();
    // Nobody selected has an e-mail: the primary action says why it is off.
    await expect(page.getByRole("button", { name: "Disparar e-mail" })).toBeDisabled();

    await page.getByRole("button", { name: "Mais ações para a seleção" }).click();
    await page.getByRole("menuitem", { name: "Descartar" }).click();
    await expect(page.getByText("3 leads descartados")).toBeVisible();
    await expect(rowOf(page, "Padaria Sol")).toHaveCount(0);
    await expect(rowOf(page, "Padaria Céu")).toBeVisible();
    await expect(page.getByText("3 selecionados")).toHaveCount(0);

    await page.getByRole("button", { name: "Desfazer" }).click();
    for (const name of ["Padaria Sol", "Padaria Lua", "Padaria Mar"]) {
      await expect(rowOf(page, name)).toBeVisible();
    }
  });

  test("clears the selection when the tab changes", async ({ page, backend }) => {
    await backend.lead({ name: "Padaria Sol" });
    await visit(page, "/leads");
    await page.getByRole("checkbox", { name: "Selecionar Padaria Sol" }).check();
    await expect(page.getByText("1 selecionado")).toBeVisible();
    await page.getByRole("tab", { name: /Todos/ }).click();
    await expect(page.getByText("1 selecionado")).toHaveCount(0);
  });

  test("adds an e-mail in place, and it survives a reload", async ({ page, backend }) => {
    const { id } = await backend.lead({ name: "Padaria Sol" });
    await visit(page, `/leads?view=all&lead=${id}`);
    const panel = page.getByRole("dialog", { name: "Padaria Sol" });
    await panel.getByRole("button", { name: "Adicionar e-mail" }).click();
    const field = panel.getByLabel("Editar e-mail");
    await field.fill("Contato@PadariaSol.com.br");
    await field.press("Enter");
    await expect(panel.getByRole("button", { name: "contato@padariasol.com.br" })).toBeVisible();

    await reload(page);
    const reopened = page.getByRole("dialog", { name: "Padaria Sol" });
    await expect(reopened.getByRole("button", { name: "contato@padariasol.com.br" })).toBeVisible();

    // Esc cancels the edit without closing the panel.
    await reopened.getByRole("button", { name: "contato@padariasol.com.br" }).click();
    await reopened.getByLabel("Editar e-mail").fill("errado");
    await page.keyboard.press("Escape");
    await expect(reopened).toBeVisible();
    await expect(reopened.getByRole("button", { name: "contato@padariasol.com.br" })).toBeVisible();
  });

  test("adds a lead by hand and finds the existing one", async ({ page, backend }) => {
    await backend.lead({ name: "Padaria Sol", email: "oi@padariasol.com.br" });
    await visit(page, "/leads");
    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Adicionar lead" }).click();
    const sheet = page.getByRole("dialog", { name: "Adicionar lead" });
    await sheet.getByLabel("Nome").fill("Café Lua");
    await sheet.getByRole("button", { name: "Adicionar lead" }).click();
    await expect(sheet.getByText("Informe um e-mail ou um telefone.")).toBeVisible();

    await sheet.getByLabel("E-mail").fill("OI@padariasol.com.br");
    await sheet.getByRole("button", { name: "Adicionar lead" }).click();
    await expect(sheet.getByText(/Já existe um lead/)).toContainText("Padaria Sol");
    await sheet.getByRole("button", { name: "Abrir o existente" }).click();
    await expect(page.getByRole("dialog", { name: "Padaria Sol" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Adicionar lead" }).click();
    await sheet.getByLabel("Nome").fill("Café Lua");
    await sheet.getByLabel("Telefone").fill("(31) 99876-5432");
    await sheet.getByRole("button", { name: "Adicionar lead" }).click();
    const panel = page.getByRole("dialog", { name: "Café Lua" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Adicionado manualmente")).toBeVisible();
    await expect(panel.getByText(/Adicionado à mão, sem site/)).toBeVisible();
  });

  test("a funnel step opens the leads it counts", async ({ page, backend }) => {
    await backend.lead({ name: "Padaria Sol", email: "oi@padariasol.com.br" });
    await backend.lead({ name: "Padaria Lua" });
    await visit(page, "/");
    await page.getByRole("link", { name: "Com e-mail: 1" }).click();
    await expect(page).toHaveURL(/\/leads\?.*hasEmail=true/);
    await expect(rowOf(page, "Padaria Sol")).toBeVisible();
    await expect(rowOf(page, "Padaria Lua")).toHaveCount(0);
  });

  test("a link to a lead that is gone says so", async ({ page }) => {
    await visit(page, "/leads/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Lead não encontrado")).toBeVisible();
    await expect(page).not.toHaveURL(/missing/);
  });
});
