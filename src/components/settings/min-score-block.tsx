import { InfoTip } from "@/components/apple-ui";
import { Field } from "@/components/field";
import { NumberStepper } from "@/components/number-stepper";
import type { AiSettingsFormState } from "@/hooks/use-ai-settings-form";
import { GLOSSARY } from "@/lib/help";
import { SettingsBlock } from "./settings-block";

const TICKS = [0, 25, 50, 75, 100];

/** "Nota mínima": the stepper, the score drawn on a ruler, and what it leaves out today. */
export function MinScoreBlock({
  state,
  minScore,
  impact,
}: {
  state: AiSettingsFormState;
  minScore: number;
  impact: string | null;
}) {
  const { form, defaults } = state;
  const clamped = Math.min(100, Math.max(0, minScore));
  return (
    <SettingsBlock
      id="nota-minima"
      title="Nota mínima"
      info={<InfoTip>{GLOSSARY.minScore.text}</InfoTip>}
      description="Abaixo dela a IA descarta o lead e não escreve para ele."
    >
      <Field
        label="Descartar leads com nota abaixo de"
        htmlFor="minScore"
        hint="Use 0 para manter todos."
        error={form.formState.errors.minScore?.message}
      >
        <NumberStepper
          {...form.register("minScore", { valueAsNumber: true })}
          id="minScore"
          className="max-w-36"
          current={state.minScore}
          min={0}
          max={100}
          step={5}
          onStep={(value) => state.setNumber("minScore", value)}
          defaultValue={defaults.minScore}
          aria-invalid={Boolean(form.formState.errors.minScore)}
        />
      </Field>
      <div className="mt-6" aria-hidden>
        <div className="relative h-2 rounded-full bg-fill">
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-primary transition-[left] duration-200 motion-reduce:transition-none"
            style={{ left: `${clamped}%` }}
          />
          <div
            className="absolute -top-1.5 h-5 w-0.5 rounded-full bg-foreground transition-[left] duration-200 motion-reduce:transition-none"
            style={{ left: `${clamped}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-tertiary tabular-nums">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
      {impact ? (
        <p className="mt-4" aria-live="polite">
          {impact}
        </p>
      ) : null}
    </SettingsBlock>
  );
}
