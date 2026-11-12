import { Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { QuotaSpentNotice } from "@/components/searches/quota-spent-notice";
import { SearchFormFields } from "@/components/searches/search-form-fields";
import { SearchSizePicker } from "@/components/searches/search-size-picker";
import { Button } from "@/components/ui/button";
import type { NewSearch } from "@/hooks/use-new-search";
import { companiesLeftToday } from "@/lib/google-quota";

/**
 * "Nova busca" fixed at the top of Buscas, in the app's card language: niche and city, how many
 * companies and what that costs. Today's spent quota disables it with the amber notice.
 */
export function SearchComposer({ newSearch }: { newSearch: NewSearch }) {
  const { usage, offerConfigured, statusLoading, blocker, pending, submit } = newSearch;
  const spent = usage ? companiesLeftToday(usage) === 0 : false;

  return (
    <form
      aria-labelledby="nova-busca"
      noValidate
      onSubmit={submit}
      className="grouped @container flex min-w-0 flex-col gap-4 p-5"
    >
      <h2 id="nova-busca" className="flex items-center gap-2 text-lg font-semibold">
        <SearchIcon aria-hidden className="size-[18px] shrink-0 text-blue" strokeWidth={2} />
        Nova busca
      </h2>
      {spent ? <QuotaSpentNotice /> : null}
      <SearchFormFields newSearch={newSearch} disabled={spent} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SearchSizePicker newSearch={newSearch} />
        <Button type="submit" disabled={spent || pending || statusLoading || Boolean(blocker)}>
          <SearchIcon />
          {pending ? "Buscando…" : "Buscar empresas"}
        </Button>
      </div>
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
    </form>
  );
}
