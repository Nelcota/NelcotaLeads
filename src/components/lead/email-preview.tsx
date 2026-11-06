import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SALES_EMAILS_OFF, type EmailText } from "@/lib/sales-email";

/**
 * An e-mail as the lead would read it, read-only. While sending is off it says so and offers
 * "Copiar texto", so the text can go out through the conversation's own channel.
 */
export function EmailPreview({
  email,
  emailsEnabled,
  onCopy,
}: {
  email: EmailText;
  emailsEnabled: boolean;
  onCopy: (email: EmailText) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="rounded-lg border px-3 py-2.5 text-sm">
        <p className="mb-1.5 font-medium">{email.subject}</p>
        <p className="whitespace-pre-line wrap-break-word text-muted-foreground">{email.body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onCopy(email)}>
          <CopyIcon />
          Copiar texto
        </Button>
        {emailsEnabled ? null : (
          <span className="text-[12.5px] text-orange">{SALES_EMAILS_OFF}</span>
        )}
      </div>
    </div>
  );
}
