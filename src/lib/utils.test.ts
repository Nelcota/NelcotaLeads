import { describe, expect, it } from "vitest";
import { cn, safeHttpUrl } from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4", undefined)).toBe("px-4");
  });
});

describe("safeHttpUrl", () => {
  it("keeps http and https links", () => {
    expect(safeHttpUrl("https://sorriso.com.br/contato")).toBe("https://sorriso.com.br/contato");
    expect(safeHttpUrl(" http://sorriso.com.br ")).toBe("http://sorriso.com.br/");
  });

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "sorriso.com.br",
    "//evil.com",
    "",
    null,
    undefined,
  ])("rejects %j", (value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });
});
