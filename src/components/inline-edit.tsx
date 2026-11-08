import { PencilIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * A value that turns into a field where it is: click the value (or the pencil) to edit, Enter
 * or clicking away saves, Esc cancels. While saving the field stays put; if the save fails the
 * text stays for another try (the caller shows the error).
 */
export function InlineEdit({
  label,
  value,
  placeholder,
  display,
  inputType = "text",
  maxLength,
  editOnValueClick = true,
  onSave,
}: {
  /** What is being edited, e.g. "e-mail"; names the field and the pencil. */
  label: string;
  value: string | null;
  /** Shown (and clickable) when there is no value, e.g. "Adicionar e-mail". */
  placeholder: string;
  /** How the saved value reads; defaults to the text itself. */
  display?: ReactNode;
  inputType?: "text" | "email" | "tel" | "url";
  maxLength?: number;
  /** False when the value is itself a link (the site): only the pencil edits it. */
  editOnValueClick?: boolean;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Refs, not state: the blur that follows Enter (or the field closing) must not save twice.
  const busy = useRef(false);
  const cancelled = useRef(false);
  const editing = draft !== null;

  const start = () => {
    cancelled.current = false;
    setDraft(value ?? "");
  };
  const save = async () => {
    if (draft === null || busy.current) return;
    if (cancelled.current || draft.trim() === (value ?? "").trim()) {
      cancelled.current = true;
      setDraft(null);
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await onSave(draft);
      cancelled.current = true;
      setDraft(null);
    } catch {
      // Keeps the field open with what was typed; the caller's toast says why.
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Input
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by the user's own click
        autoFocus
        aria-label={`Editar ${label}`}
        autoComplete="off"
        data-inline-edit=""
        type={inputType}
        value={draft}
        maxLength={maxLength}
        readOnly={saving}
        className="-my-1 h-8"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
            return;
          }
          if (event.key === "Escape") {
            // Only the field; the sheet leaves Esc alone for [data-inline-edit] (lead-sheet).
            event.preventDefault();
            event.stopPropagation();
            cancelled.current = true;
            setDraft(null);
          }
        }}
      />
    );
  }

  return (
    <span className="group/edit flex min-w-0 items-start gap-1">
      {value ? (
        editOnValueClick ? (
          <button
            type="button"
            onClick={start}
            className="min-w-0 cursor-text text-left break-words hover:underline hover:decoration-dotted hover:underline-offset-4"
          >
            {display ?? value}
          </button>
        ) : (
          <span className="min-w-0">{display ?? value}</span>
        )
      ) : (
        <button type="button" onClick={start} className="text-left font-medium text-blue">
          {placeholder}
        </button>
      )}
      {value ? (
        <Hint label={`Editar ${label}`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={start}
            aria-label={`Editar ${label}`}
            className="-my-1.5 focus-visible:opacity-100 sm:opacity-0 sm:group-hover/edit:opacity-100"
          >
            <PencilIcon className="size-3.5" />
          </Button>
        </Hint>
      ) : null}
    </span>
  );
}
