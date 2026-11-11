/** The seven type sizes of the app in px, the same as the `--text-*` tokens in `styles.css`. */
export const TYPE_SCALE_PX = [12, 13, 14, 16, 18, 28, 36] as const;

/** The scale size closest to `px`, for sizes computed at runtime (initials scaled to an avatar). */
export function nearestTypeSize(px: number): number {
  if (!Number.isFinite(px)) return TYPE_SCALE_PX[0];

  return TYPE_SCALE_PX.reduce((best, size) =>
    Math.abs(size - px) < Math.abs(best - px) ? size : best,
  );
}
