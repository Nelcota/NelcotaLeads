import { formatCount } from "./format";

/** Companies one Google request brings back: a search of 20/40/60 uses 1/2/3 requests. */
export const COMPANIES_PER_GOOGLE_REQUEST = 20;

/** Today's Google requests, as counted on the server (`placesUsage`). */
export type GoogleUsage = { used: number; limit: number };

/** Google requests a search of up to `companies` companies uses. */
export function googleRequestsFor(companies: number): number {
  return Math.ceil(Math.max(0, companies) / COMPANIES_PER_GOOGLE_REQUEST);
}

/**
 * How many more companies can be searched today. The one conversion from requests to companies:
 * every screen that shows the Google quota goes through it, so they all show the same number.
 */
export function companiesLeftToday({ used, limit }: GoogleUsage): number {
  return Math.max(0, limit - used) * COMPANIES_PER_GOOGLE_REQUEST;
}

/** "Hoje dá para buscar mais 1.000 empresas", or that today's limit was reached. */
export function companiesLeftLabel(usage: GoogleUsage): string {
  const left = companiesLeftToday(usage);
  if (left === 0) return "Limite de buscas de hoje atingido";
  return `Hoje dá para buscar mais ${formatCount(left)} empresas`;
}

/** "Esta busca usa 40 de 1.000 empresas disponíveis hoje". */
export function searchCostLabel(companies: number, usage: GoogleUsage): string {
  const used = googleRequestsFor(companies) * COMPANIES_PER_GOOGLE_REQUEST;
  const left = formatCount(companiesLeftToday(usage));
  return `Esta busca usa ${formatCount(used)} de ${left} empresas disponíveis hoje`;
}

/** Why a search of `companies` cannot start today, or null when the quota allows it. */
export function searchQuotaBlocker(companies: number, usage: GoogleUsage): string | null {
  const left = companiesLeftToday(usage);
  if (left === 0) return "Limite de buscas de hoje atingido. Volte amanhã.";
  if (googleRequestsFor(companies) * COMPANIES_PER_GOOGLE_REQUEST <= left) return null;
  return `Hoje dá para buscar só mais ${formatCount(left)} empresas. Escolha um número menor.`;
}
