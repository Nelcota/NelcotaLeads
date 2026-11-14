import { XIcon } from "lucide-react";
import { DisabledReason } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useQuickRepliesForm } from "@/hooks/use-quick-replies-form";
import { QUICK_REPLY_LIMITS, type QuickRepliesInput } from "@/lib/schemas";
import { AddRowButton } from "./add-row-button";
import { SettingsBlock } from "./settings-block";

const DESCRIPTION = "Textos prontos que entram numa resposta pelo botão Modelos, em Conversas.";
const NOTHING_TO_SAVE = "Nenhuma alteração para salvar";

/** "Respostas rápidas": the loading and error states, then the editable list. */
export function QuickRepliesBlock({
  replies,
  failed,
}: {
  replies: QuickRepliesInput["replies"] | null;
  failed: boolean;
}) {
  if (!replies) {
    return (
      <SettingsBlock id="respostas" title="Respostas rápidas" description={DESCRIPTION}>
        {failed ? (
          <p className="text-sm text-red">
            Não foi possível carregar os modelos. Atualize a página.
          </p>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </SettingsBlock>
    );
  }
  return <QuickRepliesForm defaults={{ replies }} />;
}

function QuickRepliesForm({ defaults }: { defaults: QuickRepliesInput }) {
  const state = useQuickRepliesForm(defaults);
  const { form } = state;
  const { errors } = form.formState;

  return (
    <form noValidate onSubmit={(event) => void state.submit(event)}>
      <SettingsBlock
        id="respostas"
        title="Respostas rápidas"
        description={DESCRIPTION}
        action={
          <AddRowButton
            disabledReason={state.full && `Máximo de ${QUICK_REPLY_LIMITS.count} modelos`}
            onClick={state.add}
          >
            Adicionar modelo
          </AddRowButton>
        }
      >
        {state.replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum modelo ainda. Crie um para responder mais rápido.
          </p>
        ) : null}
        <div className="grid">
          {state.replies.map((field, index) => {
            const error = errors.replies?.[index];
            return (
              <div
                key={field.id}
                className="grid gap-2 border-t border-black/[0.06] py-4 first:border-t-0 first:pt-0 dark:border-white/[0.06]"
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Nome do modelo ${index + 1}`}
                    autoComplete="off"
                    placeholder="Nome, ex.: Agendar uma ligação"
                    maxLength={QUICK_REPLY_LIMITS.title}
                    defaultValue={field.title}
                    {...form.register(`replies.${index}.title`)}
                    aria-invalid={Boolean(error?.title)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remover modelo ${index + 1}`}
                    onClick={() => state.remove(index)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </div>
                <Textarea
                  aria-label={`Texto do modelo ${index + 1}`}
                  placeholder="O texto que entra na resposta."
                  rows={3}
                  maxLength={QUICK_REPLY_LIMITS.body}
                  defaultValue={field.body}
                  {...form.register(`replies.${index}.body`)}
                  aria-invalid={Boolean(error?.body)}
                />
                {error?.title?.message || error?.body?.message ? (
                  <p className="text-xs text-destructive">
                    {error.title?.message ?? error.body?.message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
          <p className="text-sm text-tertiary">
            {state.replies.length} de {QUICK_REPLY_LIMITS.count} modelos, com até 1.000 caracteres
            cada.
          </p>
          <DisabledReason reason={!state.isDirty && NOTHING_TO_SAVE}>
            <Button type="submit" disabled={!state.isDirty || state.saving}>
              {state.saving ? "Salvando…" : "Salvar respostas rápidas"}
            </Button>
          </DisabledReason>
        </div>
      </SettingsBlock>
    </form>
  );
}
