import { describe, expect, it, vi } from "vitest";
import { extractSite, findEmails, MAX_TEXT_CHARS } from "./extract";
import { fetchSite, USER_AGENT } from "./fetch-site";
import { isPathAllowed, matches } from "./robots";

const HTML = `<!doctype html><html><head>
  <title>  Clínica Sorriso | Dentistas em BH </title>
  <meta name="description" content="Implantes e ortodontia.">
  <style>.x{color:red}</style><script>var secret = 1;</script>
</head><body>
  <h1>Clínica Sorriso</h1><p>Atendemos   desde 2010.</p>
  <a href="mailto:contato@sorriso.com.br?subject=oi">Fale conosco</a>
  <a href="tel:+553132741000">Ligue</a>
  <a href="https://www.instagram.com/sorriso?igsh=abc">Instagram</a>
  <a href="https://example.com/blog">Blog</a>
  <footer>© 2019 Clínica Sorriso. atendimento@sorriso.com.br</footer>
</body></html>`;

describe("extractSite", () => {
  it("extracts title, description, contacts, socials and clean text", () => {
    const { data, text } = extractSite(HTML, "http://sorriso.com.br/");
    expect(data).toEqual({
      finalUrl: "http://sorriso.com.br/",
      https: false,
      title: "Clínica Sorriso | Dentistas em BH",
      description: "Implantes e ortodontia.",
      socialLinks: ["https://www.instagram.com/sorriso"],
      emails: ["contato@sorriso.com.br", "atendimento@sorriso.com.br"],
      phones: ["+553132741000"],
      copyrightYear: 2019,
    });
    expect(text).toContain("Atendemos desde 2010.");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("color:red");
  });

  it("normalizes mailto addresses so duplicates collapse", () => {
    const { data } = extractSite(
      `<body><a href="mailto:%20Contato@Site.com.br">a</a><a href="mailto:contato@site.com.br">b</a></body>`,
      "https://site.com.br",
    );
    expect(data.emails).toEqual(["contato@site.com.br"]);
  });

  it("truncates long pages", () => {
    const { text } = extractSite(`<body><p>${"a".repeat(20_000)}</p></body>`, "https://x.com");
    expect(text).toHaveLength(MAX_TEXT_CHARS);
  });
});

describe("isPathAllowed", () => {
  const robots = `
User-agent: *
Disallow: /private
Allow: /private/public

User-agent: NelcotaLeadsBot
Disallow: /`;

  it("uses the group for our bot when present", () => {
    expect(isPathAllowed(robots, "NelcotaLeadsBot/1.0", "/")).toBe(false);
  });

  it("applies the longest matching rule for other agents", () => {
    expect(isPathAllowed(robots, "OtherBot/1.0", "/private/x")).toBe(false);
    expect(isPathAllowed(robots, "OtherBot/1.0", "/private/public/x")).toBe(true);
    expect(isPathAllowed(robots, "OtherBot/1.0", "/")).toBe(true);
  });

  it("supports wildcards and empty disallow", () => {
    expect(isPathAllowed("User-agent: *\nDisallow: /*.pdf$", "a", "/doc.pdf")).toBe(false);
    expect(isPathAllowed("User-agent: *\nDisallow: /*.pdf$", "a", "/doc.pdf.html")).toBe(true);
    expect(isPathAllowed("User-agent: *\nDisallow:", "a", "/anything")).toBe(true);
  });
});

const html = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

describe("fetchSite", () => {
  it("uses an ASCII-only User-Agent (required for HTTP headers)", () => {
    expect(USER_AGENT).toMatch(/^[\x20-\x7e]+$/);
    expect(() => new Headers({ "User-Agent": USER_AGENT })).not.toThrow();
  });

  it("reads the page when robots.txt is missing", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(html(HTML));
    const result = await fetchSite("sorriso.com.br", fetchFn);
    expect(result.status).toBe("ok");
    expect(fetchFn.mock.calls[0]?.[0]).toEqual(new URL("https://sorriso.com.br/robots.txt"));
  });

  it("respects robots.txt", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("User-agent: *\nDisallow: /", { status: 200 }));
    expect(await fetchSite("https://sorriso.com.br", fetchFn)).toMatchObject({ status: "blocked" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("marks network failures as unreachable instead of throwing", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    expect(await fetchSite("https://down.invalid", fetchFn)).toMatchObject({
      status: "unreachable",
    });
  });
});

describe("extractSite limits", () => {
  it("bounds scraped fields so they always pass siteDataSchema", async () => {
    const { siteDataSchema } = await import("@/lib/schemas");
    const long = "x".repeat(5_000);
    const { data } = extractSite(
      `<html><head><title>${long}</title><meta name="description" content="${long}"></head><body>
        <a href="https://instagram.com/${long}">a</a><a href="tel:${long}">b</a>
        <a href="mailto:${long}@x.com">c</a> © 0001</body></html>`,
      `https://x.com/${long}`,
    );
    expect(siteDataSchema.safeParse(data).success).toBe(true);
    expect(data.socialLinks).toEqual([]);
    expect(data.phones).toEqual([]);
    expect(data.copyrightYear).toBeNull();
  });
});

/** Deterministic pseudo-random strings over a small alphabet that hits every branch. */
function randomStrings(alphabet: string, count: number, maxLength: number) {
  let seed = 42;
  const next = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648);
  return Array.from({ length: count }, () =>
    Array.from({ length: next() % maxLength }, () => alphabet[next() % alphabet.length]).join(""),
  );
}

/** The e-mail regex findEmails replaced, as the reference for what counts as an address. */
function referenceEmails(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
}

/** The robots.txt regex `matches` replaced. */
function referenceMatch(pattern: string, path: string) {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

describe("findEmails", () => {
  it("finds the same addresses as the old regex", () => {
    for (const text of randomStrings("ab1.@-_ +cm", 3000, 40)) {
      expect(findEmails(text)).toEqual(referenceEmails(text));
    }
    expect(findEmails("contato@site.com.br. ou vendas@loja.com")).toEqual([
      "contato@site.com.br",
      "vendas@loja.com",
    ]);
  });

  it("stays linear on long runs without an address (the regex took ~9 s on 80 KB)", () => {
    for (const hostile of [
      "a".repeat(1_500_000),
      `a@${"a".repeat(1_500_000)}`,
      "a@".repeat(500_000),
    ]) {
      const started = performance.now();
      findEmails(hostile);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });
});

describe("robots matches", () => {
  it("agrees with the regex it replaced", () => {
    const patterns = randomStrings("/ab*", 400, 8).flatMap((p) => [p, `${p}$`]);
    const paths = randomStrings("/ab", 60, 10);
    for (const pattern of patterns) {
      for (const path of paths) expect(matches(pattern, path)).toBe(referenceMatch(pattern, path));
    }
  });

  it("does not backtrack on many wildcards (the regex took over a minute)", () => {
    const started = performance.now();
    expect(matches(`/${"*a".repeat(30)}*b`, `/${"a".repeat(2000)}`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(100);
  });
});
