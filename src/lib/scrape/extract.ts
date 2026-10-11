import { parseHTML } from "linkedom";
import type { SiteData } from "@/lib/schemas";

export const MAX_TEXT_CHARS = 8_000;

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const COPYRIGHT_PATTERN = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/i;

export type ExtractedSite = { data: SiteData; text: string };

/** Extracts the useful, public business information from a page's HTML. */
export function extractSite(html: string, finalUrl: string): ExtractedSite {
  // linkedom only builds a body for full documents, so wrap bare fragments.
  const { document } = parseHTML(
    /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`,
  );

  const title = clean(document.querySelector("title")?.textContent);
  const description = clean(
    document.querySelector('meta[name="description" i]')?.getAttribute("content") ??
      document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
  );

  const socialLinks = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")?.trim() ?? "";
    if (href.toLowerCase().startsWith("mailto:")) {
      const email = decodeURIComponent(href.slice(7).split("?")[0] ?? "").toLowerCase();
      if (email) emails.add(email);
    } else if (href.toLowerCase().startsWith("tel:")) {
      phones.add(href.slice(4).trim());
    } else if (/^https?:\/\//i.test(href)) {
      try {
        const host = new URL(href).hostname.replace(/^www\./, "");
        if (SOCIAL_HOSTS.some((social) => host === social || host.endsWith(`.${social}`))) {
          socialLinks.add(href.split("?")[0] ?? href);
        }
      } catch {
        // Ignore malformed URLs.
      }
    }
  }

  for (const node of document.querySelectorAll("script, style, noscript, svg, iframe, template")) {
    node.remove();
  }
  const text = clean(document.body?.textContent ?? document.documentElement?.textContent) ?? "";
  for (const email of text.match(EMAIL_PATTERN) ?? []) emails.add(email.toLowerCase());

  const year = COPYRIGHT_PATTERN.exec(text)?.[1];

  return {
    data: {
      finalUrl,
      https: finalUrl.startsWith("https://"),
      title,
      description,
      socialLinks: [...socialLinks].slice(0, 10),
      emails: [...emails].filter((email) => !/\.(png|jpe?g|gif|webp|svg)$/.test(email)).slice(0, 5),
      phones: [...phones].slice(0, 5),
      copyrightYear: year ? Number(year) : null,
    },
    text: truncate(text, MAX_TEXT_CHARS),
  };
}

function clean(value: string | null | undefined): string | null {
  const collapsed = value?.replace(/\s+/g, " ").trim();
  return collapsed ? collapsed : null;
}

export function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
