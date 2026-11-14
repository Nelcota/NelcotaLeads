import { InlineEdit } from "@/components/inline-edit";
import type { Lead } from "@/db/schema";
import { CONTACT_LIMITS } from "@/lib/lead-contact";
import { errorToast } from "@/lib/mutation-toasts";
import { updateLeadContact } from "@/server/leads";

/** The lead's name in the panel title, edited in place (click the name or the pencil). */
export function LeadName({
  lead,
  onChanged,
}: {
  lead: Pick<Lead, "id" | "name">;
  onChanged: () => Promise<unknown>;
}) {
  const save = async (value: string) => {
    try {
      await updateLeadContact({ data: { id: lead.id, field: "name", value } });
    } catch (error) {
      errorToast("Não foi possível salvar")(error);
      throw error;
    }
    await onChanged();
  };
  return (
    <InlineEdit
      label="nome"
      value={lead.name}
      placeholder="Adicionar nome"
      maxLength={CONTACT_LIMITS.name}
      onSave={save}
    />
  );
}
