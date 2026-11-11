import { BanIcon, MailXIcon } from "lucide-react";

/** Line icon for the not-ready reasons of the row hint; other hints have none. */
export function LeadHintIcon({ text }: { text: string }) {
  if (text === "Sem e-mail") {
    return <MailXIcon aria-hidden className="size-3.5 shrink-0 text-orange" strokeWidth={2} />;
  }
  if (text === "Descadastrado") {
    return (
      <BanIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
    );
  }
  return null;
}
