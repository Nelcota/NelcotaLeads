const reviewCountFormat = new Intl.NumberFormat("pt-BR");

/**
 * "4,2 (38 avaliações)", "4,8 (1 avaliação)" or just "4,2" when the review count is unknown,
 * so a missing count never shows as "0 avaliações".
 */
export function googleRatingLabel(rating: number, reviewCount: number | null): string {
  const stars = rating.toFixed(1).replace(".", ",");
  if (reviewCount === null || !Number.isFinite(reviewCount) || reviewCount < 0) return stars;
  const noun = reviewCount === 1 ? "avaliação" : "avaliações";
  return `${stars} (${reviewCountFormat.format(reviewCount)} ${noun})`;
}
