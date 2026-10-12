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
});
