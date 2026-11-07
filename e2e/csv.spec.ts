import { readFile } from "node:fs/promises";
import { expect, test, visit } from "./fixtures";

const FORMULA = '=HYPERLINK("http://x","y")';

test.describe("CSV export", () => {
  test("downloads a UTF-8 CSV with formulas neutralized", async ({ page, backend }) => {
    await backend.lead({ name: "Clínica São João", website: "https://saojoao.test" });
    await backend.lead({ name: FORMULA });

    await visit(page, "/leads?view=all");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Exportar CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^leads-todos-\d{4}-\d{2}-\d{2}\.csv$/);

    const bytes = await readFile(await download.path());
    // UTF-8 BOM, so spreadsheet apps read the accents right.
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = bytes.toString("utf8").slice(1);
    const [header, ...rows] = csv.split("\r\n");
    expect(header).toBe(
      "nome;cidade;endereco;telefone;telefone_e164;whatsapp;site;nota_google;avaliacoes;nota_ia;status;retornar_em;resumo;dores;mensagem;notas;google_maps;criado_em",
    );
    expect(rows).toHaveLength(2);

    const accented = rows.find((row) => row.startsWith("Clínica São João;"));
    expect(accented).toContain(";https://saojoao.test;");
    expect(accented).toContain(";80;Novo;");

    // The formula becomes text: a leading apostrophe inside the quoted cell.
    const injected = rows.find((row) => row.includes("HYPERLINK"));
    expect(injected?.startsWith(`"'=HYPERLINK(""http://x"",""y"")";`)).toBe(true);
  });
});
