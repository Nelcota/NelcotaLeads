import { useEffect, useRef, useState, type ChangeEvent } from "react";

/**
 * A search box backed by a URL param. The box answers every key at once and the URL catches up
 * after a pause. While the box has focus, what is typed is the source of truth: a URL update
 * still in flight (an older value) never overwrites newer typing. Changes made elsewhere (Back,
 * a link, "Limpar filtros") are followed while the box is not focused.
 */
export function useUrlSearchBox(urlValue: string, commit: (value: string) => void, delay = 300) {
  const [value, setValue] = useState(urlValue);
  const [focused, setFocused] = useState(false);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  // State adjusted during render: follow the URL, unless the user is typing in the box.
  const [synced, setSynced] = useState(urlValue);
  if (urlValue !== synced) {
    setSynced(urlValue);
    if (!focused) setValue(urlValue);
  }

  useEffect(() => {
    if (value === urlValue) return undefined;
    const timer = setTimeout(() => commitRef.current(value), delay);
    return () => clearTimeout(timer);
  }, [value, urlValue, delay]);

  /** Empties the box and the URL at once, without waiting for the pause. */
  const clear = () => {
    setValue("");
    commitRef.current("");
  };

  return {
    value,
    clear,
    inputProps: {
      value,
      autoComplete: "off",
      onChange: (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
