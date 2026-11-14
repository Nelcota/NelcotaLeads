import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SettingsPage } from "@/components/settings/settings-page";
import { settingsOverviewQuery } from "@/hooks/use-settings-overview";
import { pageTitle } from "@/lib/page-title";
import {
  autopilotQuery,
  providerStatusQuery,
  quickRepliesQuery,
  sendWindowQuery,
  serviceTableQuery,
  settingsQuery,
} from "@/lib/queries";
import { lenientSearch } from "@/lib/schemas";
import { DEFAULT_SETTINGS_TAB, settingsTabSchema } from "@/lib/settings-tabs";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: pageTitle("Configurações") }] }),
  // A wrong `?aba=` falls back to Resumo instead of breaking the page.
  validateSearch: lenientSearch(z.object({ aba: settingsTabSchema.optional() })),
  loader: ({ context }) =>
    Promise.all([
      // The forms render from these, so they are ready before the page shows.
      context.queryClient.ensureQueryData(settingsQuery),
      context.queryClient.ensureQueryData(autopilotQuery),
      context.queryClient.ensureQueryData(sendWindowQuery),
      // The mailbox renders from it; prefetching keeps SSR and hydration in agreement.
      context.queryClient.ensureQueryData(providerStatusQuery),
      // Never fail the page: each section shows its own error.
      context.queryClient.prefetchQuery(quickRepliesQuery),
      context.queryClient.prefetchQuery(serviceTableQuery),
      context.queryClient.prefetchQuery(settingsOverviewQuery),
    ]),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { aba } = Route.useSearch();
  return <SettingsPage tab={aba ?? DEFAULT_SETTINGS_TAB} />;
}
