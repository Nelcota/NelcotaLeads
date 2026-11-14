import { useEmailSettings } from "@/hooks/use-email-settings";
import { MailboxBlock } from "./mailbox-block";
import { SendRulesBlock } from "./send-rules-block";
import { SendWindowBlock } from "./send-window-block";
import { SignatureBlock } from "./signature-block";
import { UnsubscribedBlock } from "./unsubscribed-block";

/** E-mail e envio: mailbox, send window, fixed rules, signature and unsubscribed leads. */
export function EmailTab() {
  const page = useEmailSettings();
  const dailyLimit = page.mail?.limit ?? null;
  return (
    <div>
      <MailboxBlock mail={page.mail} testing={page.mailTest.testing} onTest={page.mailTest.run} />
      <SendWindowBlock
        window={page.sendWindow.window}
        error={page.sendWindow.error}
        saving={page.sendWindow.saving}
        dailyLimit={dailyLimit}
        onChange={page.sendWindow.change}
      />
      <SendRulesBlock dailyLimit={dailyLimit} />
      <SignatureBlock name={page.sender.name} company={page.sender.company} />
      <UnsubscribedBlock unsubscribed={page.unsubscribed} failed={page.unsubscribedFailed} />
    </div>
  );
}
