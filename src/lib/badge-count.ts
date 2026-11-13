/** Largest count a sidebar badge shows in full; above it the pill would push the label aside. */
export const BADGE_COUNT_MAX = 99;

/** The text inside a count badge: the number up to 99, then "99+". */
export function badgeCount(count: number): string {
  if (count > BADGE_COUNT_MAX) return `${BADGE_COUNT_MAX}+`;
  return String(count);
}
