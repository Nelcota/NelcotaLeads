/**
 * pt-BR masks for number fields, applied while the person types: dots group the thousands
 * ("1.000") and a comma starts the cents ("1.500,50").
 */

export type NumberMaskKind = "whole" | "money";

/** Longest whole part a field takes: 9 digits reach R$ 999.999.999, past any limit we check. */
const MAX_WHOLE_DIGITS = 9;

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Only the digits, without leading zeros ("0" stays) and at most MAX_WHOLE_DIGITS of them. */
function wholeDigits(text: string): string {
  return text
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_WHOLE_DIGITS);
}

/**
 * A dot typed for the cents (keyboards whose decimal key gives ".") becomes the comma. Our own
 * dots always sit before three digits, so a last dot followed by up to two digits is a decimal.
 * Keeps the length, so a caret position in the text stays valid.
 */
export function decimalDotToComma(text: string): string {
  if (text.includes(",")) return text;
  return text.replace(/\.(\d{0,2})$/, ",$1");
}

/** "1000" → "1.000"; letters, signs and extra separators are dropped. */
export function maskWholeNumber(text: string): string {
  return groupThousands(wholeDigits(text));
}

/**
 * A money field's text after an edit. Only an edit that adds characters (typing or pasting) may
 * turn a last dot into the decimal comma: a deletion that leaves "1.00" from "1.000" keeps the
 * dot as a thousands separator, so the value becomes 100 and not R$ 1,00.
 */
export function moneyAfterEdit(previous: string, next: string): string {
  if (next.length <= previous.length) return next;
  return decimalDotToComma(next);
}

/** "150000" → "150.000", "1500,5" → "1.500,5"; dots are thousands separators; no "R$". */
export function maskMoney(text: string): string {
  const commaAt = text.indexOf(",");
  if (commaAt === -1) return maskWholeNumber(text);
  const whole = maskWholeNumber(text.slice(0, commaAt));
  const cents = text
    .slice(commaAt + 1)
    .replace(/\D/g, "")
    .slice(0, 2);
  return `${whole === "" ? "0" : whole},${cents}`;
}

/** The text of a field of `kind` as it should read after a keystroke. */
export function maskNumber(kind: NumberMaskKind, text: string): string {
  if (kind === "money") return maskMoney(text);
  return maskWholeNumber(text);
}

/** Digits and the decimal comma: what the caret keeps its place by (the dots come and go). */
function isSignificant(character: string): boolean {
  return /[\d,]/.test(character);
}

/** How many significant characters stand before `caret` in `text`. */
export function significantBefore(text: string, caret: number): number {
  return text.slice(0, caret).match(/[\d,]/g)?.length ?? 0;
}

/** Where the caret goes in `masked` so that `count` significant characters stand before it. */
export function caretAfter(masked: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < masked.length; index += 1) {
    if (isSignificant(masked.charAt(index))) seen += 1;
    if (seen === count) return index + 1;
  }
  return masked.length;
}
