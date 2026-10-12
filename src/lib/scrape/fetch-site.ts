import type { SiteData } from "@/lib/schemas";
import { extractSite } from "./extract";
import { isPathAllowed } from "./robots";
import { unsafeUrlReason } from "./url-guard";

// Header values must be ASCII.
export const USER_AGENT =
  "NelcotaLeadsBot/1.0 (+uso interno; leitura de sites comerciais publicos)";
const PAGE_TIMEOUT_MS = 10_000;
const ROBOTS_TIMEOUT_MS = 5_000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_ROBOTS_BYTES = 64_000;
const MAX_REDIRECTS = 5;

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
  const unsafe = unsafeUrlReason(target);
  if (unsafe) return { status: "unreachable", reason: unsafe };

  try {
    if (!(await robotsAllows(target, fetchFn))) {
      return { status: "blocked", reason: "Bloqueado pelo robots.txt" };
    }

    const { response, url: finalUrl } = await fetchPublic(target, fetchFn, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return { status: "unreachable", reason: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { status: "unreachable", reason: `Conteúdo não é HTML (${contentType})` };
    }
    const html = await readLimited(response, MAX_HTML_BYTES);
    const { data, text } = extractSite(html, finalUrl.toString());
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
    const { response } = await fetchPublic(new URL("/robots.txt", target.origin), fetchFn, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
    });
    // RFC 9309: 4xx means no restrictions; 5xx means assume everything is disallowed.
    if (response.status >= 500) return false;
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return true;
    }
    const robots = await readLimited(response, MAX_ROBOTS_BYTES);
    return isPathAllowed(robots, USER_AGENT, target.pathname || "/");
  } catch {
    // Unreachable robots.txt (or one redirecting somewhere unsafe) imposes no rules;
    // the page fetch validates its own hops.
    return true;
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetches with manual redirects, re-validating every hop against the SSRF guard.
 * Throws when a hop is unsafe or there are too many redirects.
 */
async function fetchPublic(
  start: URL,
  fetchFn: typeof fetch,
  init: { headers: Record<string, string>; signal: AbortSignal },
): Promise<{ response: Response; url: URL }> {
  let url = start;
  for (let hop = 0; ; hop++) {
    const unsafe = unsafeUrlReason(url);
    if (unsafe) throw new Error(unsafe);
    const response = await fetchFn(url, { ...init, redirect: "manual" });
    const location = REDIRECT_STATUSES.has(response.status)
      ? response.headers.get("location")
      : null;
    if (!location) return { response, url };
    await response.body?.cancel().catch(() => undefined);
    if (hop >= MAX_REDIRECTS) throw new Error("Redirecionamentos demais");
    url = new URL(location, url);
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
    const chunk = value.subarray(0, maxBytes - bytes);
    bytes += chunk.byteLength;
    html += decoder.decode(chunk, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return html + decoder.decode();
}
