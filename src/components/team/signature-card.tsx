import { PenLineIcon } from "lucide-react";
import { GroupedRow, IconTile, SectionHeader } from "@/components/apple-ui";
import { SIGNATURE_DECISION } from "@/lib/team";

/** Read-only: who signs meeting invites and proposals, and when that was decided. */
export function SignatureCard() {
  return (
    <section className="enter min-w-0">
      <SectionHeader title="Assinatura" />
      <div className="grouped">
        <GroupedRow
          lead={<IconTile icon={PenLineIcon} tone="gray" size={30} />}
          title={`Quem assina os e-mails: ${SIGNATURE_DECISION.signature}`}
          subtitle={`Decidido em ${SIGNATURE_DECISION.decidedOn}`}
        />
      </div>
    </section>
  );
}
