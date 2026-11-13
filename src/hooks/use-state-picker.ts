import { useEffect, useState, type KeyboardEvent } from "react";
import type { StateCode } from "@/lib/brazil-states";
import { matchStates } from "@/lib/state-match";

/** The id of a state's option inside the picker's listbox. */
export function optionId(listId: string, code: StateCode) {
  return `${listId}-${code}`;
}

/**
 * State of "Ir para um estado": the typed text, whether the list is open, the active option,
 * and the keys (arrows move, Enter picks, Esc closes and then clears).
 */
export function useStatePicker(listId: string, onPick: (code: StateCode) => void) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const groups = matchStates(text);
  const options = groups.flatMap((group) => group.states.map((state) => state.code));
  const index = Math.min(activeIndex, Math.max(options.length - 1, 0));
  const active = open ? options[index] : undefined;

  // Keeps the active option in view while the arrows move through a long list.
  useEffect(() => {
    if (!active) return;
    document.getElementById(optionId(listId, active))?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const type = (value: string) => {
    setText(value);
    setActiveIndex(0);
    setOpen(true);
  };

  const pick = (code: StateCode) => {
    setText("");
    setOpen(false);
    setActiveIndex(0);
    onPick(code);
  };

  const move = (step: number) => {
    const total = Math.max(options.length, 1);
    setActiveIndex(open ? (index + step + total) % total : 0);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      if (event.nativeEvent.isComposing || !active) return;
      event.preventDefault();
      pick(active);
      return;
    }
    // The open list closes on Esc by itself; Esc on a closed list clears the text.
    if (event.key === "Escape" && !open) setText("");
  };

  const hover = (code: StateCode) => setActiveIndex(options.indexOf(code));

  return { text, open, setOpen, groups, active, type, pick, hover, onKeyDown };
}
