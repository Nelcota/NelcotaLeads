import { useState } from "react";
import { useSenderProfile } from "@/hooks/use-sender-profile";
import { InlineEditRow } from "./inline-edit-row";
import { SettingsSection } from "./settings-section";
import { SignaturePreview } from "./signature-preview";

/** "Remetente dos e-mails": the team's sender name and company, with the signature preview. */
export function SenderSection() {
  const sender = useSenderProfile();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [companyDraft, setCompanyDraft] = useState<string | null>(null);

  return (
    <SettingsSection
      id="remetente"
      title="Remetente dos e-mails"
      description="Vale para toda a equipe."
    >
      <InlineEditRow
        id="sender-name"
        label="Nome na assinatura"
        autoComplete="name"
        value={sender.senderName}
        onSave={(value) => sender.save("senderName", value)}
        onDraftChange={setNameDraft}
      />
      <InlineEditRow
        id="sender-company"
        label="Empresa na assinatura"
        autoComplete="organization"
        value={sender.senderCompany}
        onSave={(value) => sender.save("senderCompany", value)}
        onDraftChange={setCompanyDraft}
      />
      <SignaturePreview
        name={(nameDraft ?? sender.senderName).trim()}
        company={(companyDraft ?? sender.senderCompany).trim()}
      />
    </SettingsSection>
  );
}
