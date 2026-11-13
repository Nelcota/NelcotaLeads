import { Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { QuotaSpentNotice } from "@/components/searches/quota-spent-notice";
import { RepeatSearchNotice } from "@/components/searches/repeat-search-notice";
import { SaturatedSearchConfirm } from "@/components/searches/saturated-search-confirm";
import { SearchExamples } from "@/components/searches/search-examples";
import { SearchFormFields } from "@/components/searches/search-form-fields";
import { SearchSizePicker } from "@/components/searches/search-size-picker";
import { Button } from "@/components/ui/button";
import type { Search } from "@/db/schema";
import type { NewSearch } from "@/hooks/use-new-search";
import { companiesLeftToday } from "@/lib/google-quota";
import { isSaturated } from "@/lib/previous-search";

/**
 * "Nova busca" fixed at the top of Buscas, in the app's card language: niche and city, how many
 * companies and what that costs. Today's spent quota disables it with the amber notice.
 */
export function SearchComposer({
  newSearch,
  previous,
  firstSearch,
}: {
  newSearch: NewSearch;
  previous: Search | null;
  /** No search yet: examples show the expected shape of niche and city. */
  firstSearch: boolean;
}) {
  const { usage, offerConfigured, statusLoading, blocker, pending, submit } = newSearch;
  const spent = usage ? companiesLeftToday(usage) === 0 : false;
  const [confirming, setConfirming] = useState(false);
  // A place that already gave what it had asks before the quota is spent on it again.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!isSaturated(previous)) {
      submit(event);
      return;
    }
    event.preventDefault();
    setConfirming(true);
  };

  return (
    <form
      aria-labelledby="nova-busca"
      noValidate
      onSubmit={onSubmit}
      className="grouped @container flex min-w-0 flex-col gap-4 p-5"
    >
      <h2 id="nova-busca" className="flex items-center gap-2 text-lg font-semibold">
        <SearchIcon aria-hidden className="size-[18px] shrink-0 text-blue" strokeWidth={2} />
        Nova busca
      </h2>
      {spent ? <QuotaSpentNotice /> : null}
      <SearchFormFields newSearch={newSearch} disabled={spent} />
      {firstSearch && !spent ? <SearchExamples onPick={newSearch.prefill} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SearchSizePicker newSearch={newSearch} />
        <Button type="submit" disabled={spent || pending || statusLoading || Boolean(blocker)}>
          <SearchIcon />
          {pending ? "Buscando…" : "Buscar empresas"}
        </Button>
      </div>
      {spent ? null : <RepeatSearchNotice previous={previous} />}
      {blocker && !spent ? (
        <p role="alert" className="text-sm font-medium text-red">
          {blocker}
        </p>
      ) : null}
      {offerConfigured ? null : (
        <p className="text-sm text-muted-foreground">
          Sua oferta ainda não foi descrita, então a nota e a mensagem saem genéricas.{" "}
          <Link to="/settings" className="font-medium text-blue hover:underline">
            Descrever agora
          </Link>
        </p>
      )}
      {previous ? (
        <SaturatedSearchConfirm
          previous={previous}
          open={confirming}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            submit();
          }}
        />
      ) : null}
    </form>
  );
}
