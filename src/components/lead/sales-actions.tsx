import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/db/schema";
import type { LeadSales } from "@/hooks/use-lead-sales";
import { proposalStatusLine } from "@/lib/proposal";
import { MeetingForm } from "./meeting-form";
import { ProposalForm } from "./proposal-form";

type Mode = "idle" | "meeting" | "proposal";

/**
 * "Agendar reunião" and "Montar proposta" for a lead in conversation, each opening its form in
 * place of the buttons; the form closes once the server saved it.
 */
export function SalesActions({
  lead,
  sales,
  today,
}: {
  lead: Pick<Lead, "name" | "email" | "unsubscribedAt">;
  sales: LeadSales;
  today: string;
}) {
  const [mode, setMode] = useState<Mode>("idle");
  const back = () => setMode("idle");
  const hasEmail = Boolean(lead.email) && !lead.unsubscribedAt;
  if (mode === "meeting") {
    return (
      <MeetingForm
        leadName={lead.name}
        hasEmail={hasEmail}
        emailsEnabled={sales.emailsEnabled}
        today={today}
        busy={sales.scheduling}
        onConfirm={(draft) => sales.schedule(draft, { onSuccess: back })}
        onCopy={(email) => void sales.copyText(email)}
        onBack={back}
      />
    );
  }
  if (mode === "proposal" && sales.table) {
    return (
      <ProposalForm
        table={sales.table}
        leadName={lead.name}
        hasEmail={hasEmail}
        emailsEnabled={sales.emailsEnabled}
        today={today}
        busy={sales.proposing}
        onConfirm={(draft, sendEmail) => sales.propose(draft, sendEmail, { onSuccess: back })}
        onCopy={(email) => void sales.copyText(email)}
        onBack={back}
      />
    );
  }
  return (
    <>
      {sales.proposal ? (
        <p className="w-full text-[14px] text-muted-foreground">
          {proposalStatusLine(sales.proposal)}
        </p>
      ) : null}
      <Button variant="outline" onClick={() => setMode("meeting")}>
        Agendar reunião
      </Button>
      <Button variant="outline" disabled={!sales.table} onClick={() => setMode("proposal")}>
        Montar proposta
      </Button>
    </>
  );
}
