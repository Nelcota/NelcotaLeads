import { parseHTML } from "linkedom";
import { SITE_LIMITS, type SiteData } from "@/lib/schemas";

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

const fits = (max: number) => (value: string) => value.length > 0 && value.length <= max;

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
      // Re-match so stray spaces or text around the address (e.g. "mailto:%20a@b.com") are dropped.
      const email = safeDecode(href.slice(7).split("?")[0] ?? "").match(EMAIL_PATTERN)?.[0];
      if (email) emails.add(email.toLowerCase());
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

  const year = Number(COPYRIGHT_PATTERN.exec(text)?.[1]);

  // Bounded to SITE_LIMITS so the result always passes siteDataSchema.
  return {
    data: {
      finalUrl: finalUrl.slice(0, SITE_LIMITS.url),
      https: finalUrl.startsWith("https://"),
      title: title && truncate(title, SITE_LIMITS.title),
      description: description && truncate(description, SITE_LIMITS.description),
      socialLinks: [...socialLinks]
        .filter(fits(SITE_LIMITS.link))
        .slice(0, SITE_LIMITS.socialLinks),
      emails: [...emails]
        .filter(
          (email) => fits(SITE_LIMITS.email)(email) && !/\.(png|jpe?g|gif|webp|svg)$/.test(email),
        )
        .slice(0, SITE_LIMITS.emails),
      phones: [...phones].filter(fits(SITE_LIMITS.phone)).slice(0, SITE_LIMITS.phones),
      copyrightYear: year >= 1900 && year <= 2200 ? year : null,
    },
    text: truncate(text, MAX_TEXT_CHARS),
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clean(value: string | null | undefined): string | null {
  const collapsed = value?.replace(/\s+/g, " ").trim();
  return collapsed ? collapsed : null;
}

export function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
