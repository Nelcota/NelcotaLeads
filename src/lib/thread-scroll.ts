/** How far from the end (px) still counts as "at the bottom": slack for rounding and padding. */
export const BOTTOM_SLACK = 48;

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };

/** Whether a scrolled box shows its last line. */
export function isAtBottom({ scrollTop, scrollHeight, clientHeight }: ScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight <= BOTTOM_SLACK;
}

/** Opening a thread jumps straight to the end; later moves glide unless motion is reduced. */
export function bottomScrollBehavior(opening: boolean, reducedMotion: boolean): ScrollBehavior {
  if (opening || reducedMotion) return "auto";
  return "smooth";
}
