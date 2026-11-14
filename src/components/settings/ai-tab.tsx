import { FloatingBar } from "@/components/apple-ui";
import { Field } from "@/components/field";
import { DiscardChangesDialog } from "@/components/leave-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiTab } from "@/hooks/use-ai-tab";
import { CriteriaList } from "./criteria-list";
import { MinScoreBlock } from "./min-score-block";
import { SettingsBlock } from "./settings-block";
import { ToneBlock } from "./tone-block";

/** IA e pontuação: offer, criteria, minimum score and tone in one form, saved together. */
export function AiTab() {
  const { state, impact, minScore } = useAiTab();
  const { form, defaults } = state;
  const { errors } = form.formState;

  // Inputs get explicit defaultValue so the server-rendered HTML is already filled in.
  return (
    <form noValidate onSubmit={(event) => void state.submit(event)}>
      <SettingsBlock
        id="oferta"
        title="Oferta e cliente ideal"
        description="Quanto mais específico, melhor a nota e a mensagem."
      >
        <div className="grid gap-6">
          <Field
            label="O que você oferece"
            htmlFor="offer"
            hint="Ex.: criação de sites e automação de agendamento para clínicas odontológicas"
            error={errors.offer?.message}
          >
            <Textarea
              id="offer"
              rows={3}
              defaultValue={defaults.offer}
              {...form.register("offer")}
            />
          </Field>
          <Field
            label="Para quem"
            htmlFor="idealCustomer"
            hint="Ex.: clínicas pequenas, sem site ou com site antigo, que dependem de indicação"
            error={errors.idealCustomer?.message}
          >
            <Textarea
              id="idealCustomer"
              rows={3}
              defaultValue={defaults.idealCustomer}
              {...form.register("idealCustomer")}
            />
          </Field>
        </div>
      </SettingsBlock>
      <CriteriaList state={state} />
      <MinScoreBlock state={state} minScore={minScore} impact={impact} />
      <ToneBlock tone={state.tone} onChange={state.setTone} />

      {state.isDirty || state.saving ? (
        <FloatingBar>
          <span className="text-sm opacity-80">Oferta e critérios não salvos</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={state.askDiscard}
            disabled={state.saving}
          >
            Descartar
          </Button>
          <Button type="submit" size="sm" disabled={state.saving}>
            {state.saving ? "Salvando…" : "Salvar"}
          </Button>
        </FloatingBar>
      ) : null}
      <DiscardChangesDialog
        open={state.confirmDiscard}
        onCancel={state.cancelDiscard}
        onDiscard={state.discard}
      />
    </form>
  );
}
