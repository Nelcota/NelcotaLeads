import { MinusIcon } from "lucide-react";
import { Controller } from "react-hook-form";
import { DisabledReason } from "@/components/apple-ui";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChoicePill } from "@/components/ui/choice-pill";
import { MAX_TARGETS, type AutopilotFormState } from "@/hooks/use-autopilot-form";
import { AUTOPILOT_RESULTS } from "@/lib/schemas";
import { AddRowButton } from "./add-row-button";
import { HourStepper } from "./hour-stepper";

const NOTHING_TO_SAVE = "Nenhuma alteração para salvar";

/** "O que a busca diária procura": niches and cities, the hour and the size, with "Salvar". */
export function DailySearchFields({ state }: { state: AutopilotFormState }) {
  const { form } = state;
  const { errors } = form.formState;
  return (
    <section
      aria-labelledby="buscar-title"
      className="grid gap-2 border-t border-black/[0.06] pt-7 dark:border-white/[0.06]"
    >
      <h2 id="buscar-title" className="text-lg font-semibold">
        O que a busca diária procura
      </h2>
      <p className="mb-2 text-sm text-muted-foreground">
        Até {MAX_TARGETS} nichos. Cada dia a busca cai num bairro diferente da cidade.
      </p>
      {state.targets.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Input
              aria-label={`Nicho ${index + 1}`}
              autoComplete="off"
              placeholder="Nicho, ex.: dentistas"
              defaultValue={field.niche}
              {...form.register(`targets.${index}.niche`)}
              aria-invalid={Boolean(errors.targets?.[index]?.niche)}
            />
            <span className="text-sm text-tertiary">em</span>
            <Input
              aria-label={`Cidade ${index + 1}`}
              autoComplete="off"
              placeholder="Cidade, ex.: Belo Horizonte"
              defaultValue={field.city}
              {...form.register(`targets.${index}.city`)}
              aria-invalid={Boolean(errors.targets?.[index]?.city)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Remover busca ${index + 1}`}
            onClick={() => state.removeTarget(index)}
          >
            <MinusIcon aria-hidden />
          </Button>
        </div>
      ))}
      <AddRowButton
        disabledReason={state.full && `Máximo de ${MAX_TARGETS} nichos`}
        onClick={state.addTarget}
      >
        Adicionar nicho e cidade
      </AddRowButton>

      {/* items-start: a hint that wraps on one side must not push the other field down. */}
      <div className="mt-4 grid items-start gap-6 sm:grid-cols-2">
        <Field label="Horário" hint="Horário de Brasília.">
          <Controller
            control={form.control}
            name="hour"
            render={({ field }) => (
              <HourStepper label="Horário da busca" value={field.value} onChange={field.onChange} />
            )}
          />
        </Field>
        <Field
          label="Empresas por nicho, por dia"
          hint="Somadas às buscas manuais, contam no limite diário de empresas do Google."
        >
          <Controller
            control={form.control}
            name="results"
            render={({ field }) => (
              <div
                role="radiogroup"
                aria-label="Empresas por nicho"
                className="flex flex-wrap gap-2"
              >
                {AUTOPILOT_RESULTS.map((n) => (
                  <ChoicePill
                    key={n}
                    role="radio"
                    aria-checked={field.value === n}
                    selected={field.value === n}
                    onClick={() => field.onChange(n)}
                  >
                    até {n}
                  </ChoicePill>
                ))}
              </div>
            )}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] pt-5 dark:border-white/[0.06]">
        {state.isDirty ? (
          <Button type="button" variant="ghost" disabled={state.saving} onClick={state.askDiscard}>
            Descartar
          </Button>
        ) : null}
        <DisabledReason reason={!state.isDirty && NOTHING_TO_SAVE}>
          <Button type="submit" disabled={!state.isDirty || state.saving}>
            {state.saving ? "Salvando…" : "Salvar busca diária"}
          </Button>
        </DisabledReason>
      </div>
    </section>
  );
}
