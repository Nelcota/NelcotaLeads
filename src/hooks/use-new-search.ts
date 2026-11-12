import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { companiesLeftToday, searchQuotaBlocker, type GoogleUsage } from "@/lib/google-quota";
import { errorToast } from "@/lib/mutation-toasts";
import { providerStatusQuery } from "@/lib/queries";
import { newSearchSchema, type NewSearchInput } from "@/lib/schemas";
import { createSearch } from "@/server/searches";

/** The sizes offered for a new search: one, two or three Google requests. */
export const SEARCH_SIZES = [20, 40, 60] as const;

type ProviderStatus = {
  placesConfigured: boolean;
  aiConfigured: boolean;
};

/** Plain words for a missing key; how to set the keys up is in the README. */
function missingKeysText(status: ProviderStatus | undefined): string | null {
  if (!status) return null;
  if (!status.placesConfigured && !status.aiConfigured) {
    return "As chaves do Google e da IA não estão configuradas.";
  }
  if (!status.placesConfigured) return "A chave do Google não está configurada.";
  if (!status.aiConfigured) return "A chave da IA não está configurada.";
  return null;
}

type QuotaStatus = ProviderStatus & { placesUsage: GoogleUsage };

/** Why the form cannot search: a missing key first, then today's quota. */
function searchBlocker(status: QuotaStatus | undefined, companies: number): string | null {
  const keys = missingKeysText(status);
  if (keys) return `${keys} Fale com quem administra o sistema.`;
  if (!status) return null;
  return searchQuotaBlocker(companies, status.placesUsage);
}

/** The largest offered size that today's quota still covers, or null when none does. */
function largestFittingSize(usage: GoogleUsage): number | null {
  const left = companiesLeftToday(usage);
  const fits = SEARCH_SIZES.filter((size) => size <= left);
  return fits.at(-1) ?? null;
}

/**
 * The "Nova busca" form shared by the Buscas page and the dialog: fields, quota, what blocks it
 * and the submit. A created search opens its leads, which show up as the analysis finishes.
 */
export function useNewSearch({ onCreated }: { onCreated?: () => void } = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status, isPending: statusLoading } = useQuery(providerStatusQuery);
  const form = useForm<NewSearchInput>({
    resolver: zodResolver(newSearchSchema),
    defaultValues: { niche: "", city: "", maxResults: SEARCH_SIZES[0] },
  });
  const maxResults = useWatch({ control: form.control, name: "maxResults" });
  const usage = status?.placesUsage;

  const mutation = useMutation({
    mutationFn: (data: NewSearchInput) => createSearch({ data }),
    onSuccess: async ({ searchId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: providerStatusQuery.queryKey }),
      ]);
      onCreated?.();
      await navigate({ to: "/leads", search: { searchId, view: "all" } });
    },
    onError: errorToast("Não foi possível iniciar a busca"),
  });

  const blocker = searchBlocker(status, maxResults);

  // A size that no longer fits today's quota steps down to the largest one that does.
  const fitting = usage ? largestFittingSize(usage) : null;
  useEffect(() => {
    if (fitting === null || fitting >= maxResults) return;
    form.setValue("maxResults", fitting);
  }, [fitting, maxResults, form]);

  const submit = (event: FormEvent<HTMLFormElement>) =>
    void form.handleSubmit((data) => mutation.mutate(data))(event);

  /** Fills the form from an older search; an empty city is left for the user to type. */
  const prefill = (niche: string, city: string) => {
    form.setValue("niche", niche, { shouldValidate: false });
    form.setValue("city", city, { shouldValidate: false });
    form.setFocus(city ? "niche" : "city");
  };

  return {
    form,
    errors: form.formState.errors,
    maxResults,
    usage,
    offerConfigured: status?.offerConfigured ?? true,
    statusLoading,
    blocker,
    pending: mutation.isPending,
    submit,
    prefill,
  };
}

export type NewSearch = ReturnType<typeof useNewSearch>;
