const APP_NAME = "Nelcota Leads";

/** The browser tab title of a page: "Leads · Nelcota Leads". */
export function pageTitle(page: string): string {
  return `${page} · ${APP_NAME}`;
}

const COUNT_PREFIX = /^\(\d+\) /;

/** Puts the "Precisa de você" count in front of a tab title, replacing any earlier count. */
export function withAttentionCount(title: string, count: number): string {
  const base = title.replace(COUNT_PREFIX, "");
  return count > 0 ? `(${count}) ${base}` : base;
}
