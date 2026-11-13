import { useState } from "react";
import { useReportDirtyForm } from "@/components/leave-guard";

const EMPTY_FIELD = "Preencha este campo.";

type InlineFieldOptions = {
  /** Names the field for the leave guard ("sender-name"). */
  id: string;
  value: string;
  /** Rejects when the save fails; the caller shows the error and the field stays open. */
  onSave: (value: string) => Promise<unknown>;
  /** The text being typed, or null when the field closes (the signature preview follows it). */
  onDraftChange?: (draft: string | null) => void;
};

/**
 * One value edited where it is shown: closed it is text, "Editar" opens a field with Cancelar
 * and Salvar. An empty value is refused; saving the same value just closes the field.
 */
export function useInlineField({ id, value, onSave, onDraftChange }: InlineFieldOptions) {
  const [draft, setDraftState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useReportDirtyForm(id, draft !== null && draft.trim() !== value);

  const changeDraft = (next: string | null) => {
    setDraftState(next);
    onDraftChange?.(next);
  };

  const start = () => {
    setError(null);
    changeDraft(value);
  };

  const cancel = () => {
    setError(null);
    changeDraft(null);
  };

  const type = (next: string) => {
    setError(null);
    changeDraft(next);
  };

  const submit = async () => {
    if (draft === null || saving) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setError(EMPTY_FIELD);
      return;
    }
    if (trimmed === value) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      cancel();
    } catch {
      // The save's own error toast already told the person; the field stays open to retry.
    } finally {
      setSaving(false);
    }
  };

  return { editing: draft !== null, draft: draft ?? "", error, saving, start, cancel, type, submit };
}
