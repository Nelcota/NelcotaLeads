import { Link } from "@tanstack/react-router";
import { ClockIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { Label } from "@/components/ui/label";
import { SEARCH_SIZES, type NewSearch } from "@/hooks/use-new-search";
import {
  companiesLeftToday,
  COMPANIES_PER_GOOGLE_REQUEST,
  googleRequestsFor,
  searchCostLabel,
} from "@/lib/google-quota";

const FIELD =
  "h-12 w-full min-w-0 rounded-xl border border-input bg-card-2 px-3.5 text-base transition-colors outline-none placeholder:text-tertiary hover:border-tertiary focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red";

/** Amber border, no fill: today's Google quota is spent, the form waits until tomorrow. */
function QuotaSpentNotice() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-orange/45 px-4 py-3.5"
    >
      <ClockIcon aria-hidden strokeWidth={1.8} className="mt-0.5 size-5 shrink-0 text-orange" />
      <div>
        <p className="text-base font-semibold">O limite de hoje acabou</p>
        <p className="text-sm text-muted-foreground">
          Dá para buscar de novo amanhã, a partir de 00:00. As buscas abaixo continuam abertas.
        </p>
      </div>
    </div>
  );
}

/** "Nova busca" fixed at the top of Buscas: niche and city, how many companies, what it costs. */
export function SearchComposer({ newSearch }: { newSearch: NewSearch }) {
  const {
    form,
    errors,
    maxResults,
    usage,
    offerConfigured,
    statusLoading,
    blocker,
    pending,
    submit,
  } = newSearch;
  const left = usage ? companiesLeftToday(usage) : null;
  const spent = left === 0;
  const fieldError = errors.niche?.message ?? errors.city?.message;

  return (
    <form
      aria-labelledby="nova-busca"
      noValidate
      onSubmit={submit}
      className="grid gap-4 rounded-[20px] border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="nova-busca" className="text-xl font-semibold">
        Nova busca
      </h2>
      {spent ? <QuotaSpentNotice /> : null}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="grid gap-2">
          <Label htmlFor="search-niche" className="text-sm font-semibold">
            Nicho
          </Label>
          <input
            id="search-niche"
            autoComplete="off"
            enterKeyHint="next"
            placeholder="Ex.: dentistas"
            disabled={spent}
            aria-invalid={Boolean(errors.niche)}
            className={FIELD}
            {...form.register("niche")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="search-city" className="text-sm font-semibold">
            Cidade
          </Label>
          <input
            id="search-city"
            autoComplete="address-level2"
            enterKeyHint="search"
            placeholder="Ex.: Belo Horizonte"
            disabled={spent}
            aria-invalid={Boolean(errors.city)}
            className={FIELD}
            {...form.register("city")}
          />
        </div>
        {/* 48px to line up with the 48px fields (mockup v4, 2026-11-12). */}
        <Button type="submit" size="lg" disabled={pending || statusLoading || Boolean(blocker)}>
          <SearchIcon />
          {pending ? "Buscando…" : "Buscar empresas"}
        </Button>
      </div>
      {fieldError ? <p className="text-sm text-red">{fieldError}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label="Quantas empresas"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 text-sm font-semibold">Quantas empresas</span>
          {SEARCH_SIZES.map((size) => {
            const tooMany =
              left !== null && googleRequestsFor(size) * COMPANIES_PER_GOOGLE_REQUEST > left;
            return (
              <ChoicePill
                key={size}
                size="sm"
                role="radio"
                aria-checked={maxResults === size}
                selected={maxResults === size}
                disabled={spent || tooMany}
                title={tooMany && !spent ? "Passa do que resta hoje" : undefined}
                onClick={() => form.setValue("maxResults", size)}
              >
                até {size}
              </ChoicePill>
            );
          })}
        </div>
        {usage && !spent ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
            <MapPinIcon aria-hidden strokeWidth={1.6} className="size-4 shrink-0" />
            {searchCostLabel(maxResults, usage)}
          </p>
        ) : null}
        {statusLoading ? <p className="text-sm text-muted-foreground">Carregando a cota…</p> : null}
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
