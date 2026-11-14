import { useRef, type KeyboardEvent } from "react";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/** Which way an arrow key moves in a radio group: 1, -1, or 0 for any other key. */
function arrowStep(key: string): number {
  if (NEXT_KEYS.has(key)) return 1;
  if (PREVIOUS_KEYS.has(key)) return -1;
  return 0;
}

/**
 * Arrow keys for a radio group, as the platform does it: they move to the next option (wrapping
 * around), pick it and focus it. `register` hands each option its ref.
 */
export function useRadioArrows<T>(options: readonly T[], onPick: (option: T) => void) {
  const elements = useRef<(HTMLElement | null)[]>([]);

  const register = (index: number) => (element: HTMLElement | null) => {
    elements.current[index] = element;
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = arrowStep(event.key);
    if (step === 0) return;
    event.preventDefault();
    const target = (index + step + options.length) % options.length;
    const option = options[target];
    if (option === undefined) return;
    onPick(option);
    elements.current[target]?.focus();
  };

  return { register, onKeyDown };
}
