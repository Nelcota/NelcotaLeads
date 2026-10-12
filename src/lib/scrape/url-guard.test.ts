import { describe, expect, it, vi } from "vitest";
import { fetchSite } from "./fetch-site";
import { unsafeUrlReason } from "./url-guard";

describe("unsafeUrlReason", () => {
  it.each([
    "ftp://example.com/",
    "file:///etc/passwd",
    "http://user:pass@example.com/",
    "http://user@example.com/",
    "http://example.com:8080/",
    "https://example.com:22/",
    "http://localhost/",
    "http://LOCALHOST./",
    "http://app.localhost/",
    "http://printer.local/",
    "http://metadata.google.internal/",
    "http://intranet/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.0.0.1/", // hex
    "http://0177.0.0.1/", // octal
    "http://017700000001/",
    "http://0/",
    "http://0.0.0.0/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://100.127.255.255/",
    "http://224.0.0.1/",
    "http://255.255.255.255/",
    "http://[::]/",
    "http://[::1]/",
    "http://[0:0:0:0:0:0:0:1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:a9fe:a9fe]/", // mapped 169.254.169.254
    "http://[64:ff9b::10.0.0.1]/",
    "http://[2002:c0a8:0101::1]/", // 6to4 of 192.168.1.1
    "http://[fc00::1]/",
    "http://[fd12:3456::1]/",
    "http://[fe80::1]/",
    "http://[ff02::1]/",
  ])("blocks %s", (url) => {
    expect(unsafeUrlReason(new URL(url))).not.toBeNull();
  });

  it.each([
    "https://example.com/",
    "http://example.com/",
    "https://example.com:443/path",
    "http://example.com:80/",
    "https://clinica.com.br/contato?x=1",
    "http://8.8.8.8/",
    "http://172.32.0.1/",
    "http://100.128.0.1/",
    "http://[2606:4700:4700::1111]/",
    "http://[::ffff:8.8.8.8]/",
  ])("allows %s", (url) => {
    expect(unsafeUrlReason(new URL(url))).toBeNull();
  });
});

const href = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();
const html = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html" } });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe("fetchSite SSRF guard", () => {
  it("refuses private targets without fetching", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    expect(await fetchSite("http://169.254.169.254/", fetchFn)).toMatchObject({
      status: "unreachable",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("uses manual redirects and stops at a redirect to a private address", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(redirect("http://127.0.0.1/admin"));
    expect(await fetchSite("https://example.com", fetchFn)).toMatchObject({
      status: "unreachable",
      reason: "Endereço não permitido",
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    for (const call of fetchFn.mock.calls) expect(call[1]?.redirect).toBe("manual");
  });

  it("follows safe redirects and reports the final URL", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(redirect("/home"))
      .mockResolvedValueOnce(html("<title>Oi</title>"));
    const result = await fetchSite("https://example.com", fetchFn);
    expect(result).toMatchObject({ status: "ok", data: { finalUrl: "https://example.com/home" } });
  });

  it("gives up after too many redirects", async () => {
    const fetchFn = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(href(input));
      if (url.pathname === "/robots.txt") return new Response("", { status: 404 });
      return redirect(`/loop${url.pathname.length}`);
    });
    expect(await fetchSite("https://example.com", fetchFn)).toMatchObject({
      status: "unreachable",
      reason: "Redirecionamentos demais",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1 + 6);
  });

  it("does not follow a robots.txt redirect to a private address", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirect("http://10.0.0.1/robots.txt"))
      .mockResolvedValueOnce(html("<title>Oi</title>"));
    expect(await fetchSite("https://example.com", fetchFn)).toMatchObject({ status: "ok" });
    const urls = fetchFn.mock.calls.map((call) => href(call[0]));
    expect(urls).toEqual(["https://example.com/robots.txt", "https://example.com/"]);
  });

  it("caps the robots.txt read", async () => {
    const huge = `User-agent: *\nDisallow: /\n${"#".repeat(500_000)}`;
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(huge));
    expect(await fetchSite("https://example.com", fetchFn)).toMatchObject({ status: "blocked" });
  });
});
