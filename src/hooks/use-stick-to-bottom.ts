import { useEffect, useRef, type UIEvent } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { bottomScrollBehavior, isAtBottom } from "@/lib/thread-scroll";

/**
 * Keeps a scrolling thread on its newest message: it opens at the end, and when `contentKey`
 * changes (a message sent or received) it follows only if the user was already at the bottom.
 * `contentKey` is null until the content has loaded.
 */
export function useStickToBottom(contentKey: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const opened = useRef(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);

  useEffect(() => {
    const element = ref.current;
    if (!element || contentKey === null) return;
    if (!atBottom.current) return;
    const behavior = bottomScrollBehavior(!opened.current, reducedMotion);
    opened.current = true;
    element.scrollTo({ top: element.scrollHeight, behavior });
  }, [contentKey, reducedMotion]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    atBottom.current = isAtBottom(event.currentTarget);
  };

  return { ref, onScroll };
}
