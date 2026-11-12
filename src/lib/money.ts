/** Largest deal value accepted (R$ 100 milhões), far above any real sale. */
export const MAX_DEAL_CENTS = 10_000_000_000;

const wholeReais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const withCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});
const moneyInput = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "R$ 1.490", or "R$ 1.490,50" when there are cents. */
export function formatCents(cents: number): string {
  const format = cents % 100 === 0 ? wholeReais : withCents;
  // Intl puts a no-break space after "R$"; a plain one copies and compares better.
  return format.format(cents / 100).replace(/\s/g, " ");
}

/** "1.490,50" for a money field (no "R$", always two decimals). */
export function formatMoneyInput(cents: number): string {
  return moneyInput.format(cents / 100);
}

// "1.490,50", "1490,5", "1.490" (thousands only) or "1490.50" (a dot for the cents).
const WITH_COMMA = /^\d{1,3}(?:\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/;
const THOUSANDS_ONLY = /^\d{1,3}(?:\.\d{3})+$/;
const DOT_DECIMAL = /^\d+\.\d{1,2}$/;

/**
 * Cents typed in a pt-BR money field ("R$ 1.490,50", "1490", "1.490"), or null when it is not
 * a positive amount within MAX_DEAL_CENTS.
 */
export function parseMoneyInput(text: string): number | null {
  const value = text.replace(/R\$/i, "").replace(/\s/g, "");
  const cents = toCents(value);
  if (cents === null || cents <= 0 || cents > MAX_DEAL_CENTS) return null;
  return cents;
}

function toCents(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value) * 100;
  if (THOUSANDS_ONLY.test(value)) return Number(value.replace(/\./g, "")) * 100;
  if (WITH_COMMA.test(value)) return decimalCents(value.replace(/\./g, "").replace(",", "."));
  if (DOT_DECIMAL.test(value)) return decimalCents(value);
  return null;
}

function decimalCents(value: string): number {
  const [reais = "0", fraction = ""] = value.split(".");
  return Number(reais) * 100 + Number(fraction.padEnd(2, "0"));
}
