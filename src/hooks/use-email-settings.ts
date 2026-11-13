import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { providerStatusQuery, settingsQuery } from "@/lib/queries";
import { useMailTest } from "./use-mail-test";
import { useSendWindow } from "./use-send-window";
import { useSettingsOverview } from "./use-settings-overview";

/**
 * Configurações → E-mail e envio: the mailbox and its test, the send window (saved at once),
 * the sender that signs the e-mails and the latest unsubscribed leads.
 */
export function useEmailSettings() {
  const { data: status } = useQuery(providerStatusQuery);
  const { data: settings } = useSuspenseQuery(settingsQuery);
  const sendWindow = useSendWindow();
  const mailTest = useMailTest();
  const { overview, failed } = useSettingsOverview();

  return {
    mail: status?.mail ?? null,
    sendWindow,
    mailTest,
    sender: { name: settings.senderName.trim(), company: settings.senderCompany.trim() },
    unsubscribed: overview?.unsubscribed ?? null,
    unsubscribedFailed: failed,
  };
}
