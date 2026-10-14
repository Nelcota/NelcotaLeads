/**
 * The value one −/+ press away: the next multiple of `step` in that direction, kept within
 * [min, max]. A field that isn't a number yet starts from 0.
 */
export function stepValue(
  current: number,
  direction: 1 | -1,
  { min, max, step }: { min: number; max: number; step: number },
): number {
  const from = Number.isFinite(current) ? current : 0;
  const next =
    direction > 0 ? Math.floor(from / step) * step + step : Math.ceil(from / step) * step - step;
  return Math.min(max, Math.max(min, next));
}
