import { XIcon } from "@/components/icons";
import { NumberStepper } from "@/components/number-stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiSettingsFormState } from "@/hooks/use-ai-settings-form";
import { cn } from "@/lib/utils";
import { AddRowButton } from "./add-row-button";
import { SettingsBlock } from "./settings-block";

// Same bounds as the criterion schema (src/lib/schemas.ts).
const WEIGHT_RANGE = { min: -100, max: 100 };

/** "Critérios de pontuação": each signal with its weight; the score is their sum, up to 100. */
export function CriteriaList({ state }: { state: AiSettingsFormState }) {
  const { form, criteria, watchedCriteria, maxScore } = state;
  const { errors } = form.formState;
  return (
    <SettingsBlock
      id="criterios"
      title="Critérios de pontuação"
      description="A nota soma os pesos dos critérios que valem para cada empresa, até 100."
      action={<AddRowButton onClick={state.addCriterion}>Adicionar critério</AddRowButton>}
    >
      <div className="grid grid-cols-[1fr_7.5rem_32px] gap-2 pb-1 text-xs font-medium text-tertiary">
        <span>Sinal</span>
        <span className="text-center">Peso</span>
      </div>
      <div className="grid gap-2">
        {criteria.map((field, index) => {
          const weight = watchedCriteria?.[index]?.weight ?? field.weight;
          return (
            <div key={field.id} className="grid grid-cols-[1fr_7.5rem_32px] items-center gap-2">
              <Input
                aria-label={`Sinal ${index + 1}`}
                autoComplete="off"
                defaultValue={field.label}
                {...form.register(`criteria.${index}.label`)}
                aria-invalid={Boolean(errors.criteria?.[index]?.label)}
              />
              <NumberStepper
                {...form.register(`criteria.${index}.weight`, { valueAsNumber: true })}
                aria-label={`Peso ${index + 1}`}
                current={weight}
                min={WEIGHT_RANGE.min}
                max={WEIGHT_RANGE.max}
                step={5}
                onStep={(value) => state.setNumber(`criteria.${index}.weight`, value)}
                inputClassName={cn(
                  Number.isFinite(weight) && weight > 0 && "text-green",
                  Number.isFinite(weight) && weight < 0 && "text-red",
                )}
                defaultValue={field.weight}
                aria-invalid={Boolean(errors.criteria?.[index]?.weight)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover critério ${index + 1}`}
                onClick={() => state.removeCriterion(index)}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Soma dos pesos positivos:{" "}
        <span
          className={cn(
            "font-medium tabular-nums",
            maxScore === 100 ? "text-green" : "text-orange",
          )}
        >
          {maxScore}
        </span>
        {maxScore < 100 ? " (a nota máxima possível fica abaixo de 100)" : null}
      </p>
    </SettingsBlock>
  );
}
