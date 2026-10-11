import { describe, expect, it, vi } from "vitest";
import { extractSite, MAX_TEXT_CHARS } from "./extract";
import { fetchSite } from "./fetch-site";
import { isPathAllowed } from "./robots";

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
