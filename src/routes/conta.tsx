import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/account/account-page";
import { pageTitle } from "@/lib/page-title";
import { accountQuery, providerStatusQuery, settingsQuery, systemStatusQuery } from "@/lib/queries";

export const Route = createFileRoute("/conta")({
  head: () => ({ meta: [{ title: pageTitle("Conta") }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQuery),
      context.queryClient.ensureQueryData(providerStatusQuery),
      context.queryClient.ensureQueryData(accountQuery),
      context.queryClient.ensureQueryData(systemStatusQuery),
    ]),
  component: AccountPage,
});
