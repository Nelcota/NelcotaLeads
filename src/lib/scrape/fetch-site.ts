import type { SiteData } from "@/lib/schemas";
import { extractSite } from "./extract";
import { isPathAllowed } from "./robots";

// Header values must be ASCII.
export const USER_AGENT =
  "NelcotaLeadsBot/1.0 (+uso interno; leitura de sites comerciais publicos)";
const PAGE_TIMEOUT_MS = 10_000;
const ROBOTS_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 1_500_000;

export type SiteResult =
  | { status: "ok"; data: SiteData; text: string }
  | { status: "blocked" | "unreachable"; reason: string };

/** Reads a public business website, honoring robots.txt. Never throws. */
export async function fetchSite(url: string, fetchFn: typeof fetch = fetch): Promise<SiteResult> {
  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return { status: "unreachable", reason: "URL inválida" };
  }

  try {
    if (!(await robotsAllows(target, fetchFn))) {
      return { status: "blocked", reason: "Bloqueado pelo robots.txt" };
    }

    const response = await fetchFn(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return { status: "unreachable", reason: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { status: "unreachable", reason: `Conteúdo não é HTML (${contentType})` };
    }
    const html = await readLimited(response, MAX_HTML_BYTES);
    const { data, text } = extractSite(html, response.url || target.toString());
    return { status: "ok", data, text };
  } catch (error) {
    return {
      status: "unreachable",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function robotsAllows(target: URL, fetchFn: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchFn(new URL("/robots.txt", target.origin), {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
    });
    // RFC 9309: 4xx means no restrictions; 5xx means assume everything is disallowed.
    if (response.status >= 500) return false;
    if (!response.ok) return true;
    return isPathAllowed(await response.text(), USER_AGENT, target.pathname || "/");
  } catch {
    return true;
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return html + decoder.decode();
}
