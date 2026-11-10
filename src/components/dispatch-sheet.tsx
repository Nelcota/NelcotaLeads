import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  SendIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { Avatar, Hint, IconTile, PropertyRow, SaveStatus } from "@/components/apple-ui";
import { DispatchRecipients, type DispatchRecipient } from "@/components/dispatch-recipients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDispatchDrafts, type DispatchDraft } from "@/hooks/use-dispatch-drafts";
import { useAutosave } from "@/lib/autosave";
import { coldRemaining, writeDraftsLabel } from "@/lib/dispatch-review";
import { autopilotQuery, coldRoomQuery, providerStatusQuery } from "@/lib/queries";
import { SEND_GAP_MINUTES } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { setAutomation } from "@/server/dashboard";
import { dispatchEmails, removeDraft, rewriteDraft, updateDraft } from "@/server/mail";

type DraftText = { subject: string; body: string };

/**
 * Review step of a send: lists the selected leads with the drafts already written; the AI
 * writes the missing ones only when asked ("Escrever"). The user can edit, rewrite or drop
 * each e-mail, then everything goes to the spaced-out send queue.
 */
export function DispatchSheet({
  recipients,
  open,
  onOpenChange,
  onDispatched,
}: {
  recipients: DispatchRecipient[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatched: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-[620px]">
        {open ? (
          <DispatchReview
            recipients={recipients}
            onClose={() => onOpenChange(false)}
            onDispatched={onDispatched}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DispatchReview({
  recipients,
  onClose,
  onDispatched,
}: {
  recipients: DispatchRecipient[];
  onClose: () => void;
  onDispatched: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery(providerStatusQuery);
  const { data: automationSettings } = useQuery(autopilotQuery);
  const { data: coldRoom } = useQuery(coldRoomQuery);
  const review = useDispatchDrafts(recipients.map((recipient) => recipient.id));
  const { drafts, skipped } = review;
  const [edits, setEdits] = useState<Record<string, DraftText>>({});
  const [index, setIndex] = useState(0);

  const current = drafts[Math.min(index, drafts.length - 1)];
  const value = current
    ? (edits[current.id] ?? { subject: current.subject, body: current.body })
    : null;

  // Edits are stored as they are typed, so closing the sheet keeps them.
  const autosave = useAutosave(
    (id, edit: DraftText) => updateDraft({ data: { id, ...edit } }),
    errorToast("Não foi possível salvar a edição", { id: "dispatch-draft" }),
  );
  const edit = (id: string, next: DraftText) => {
    setEdits((all) => ({ ...all, [id]: next }));
    // The server keeps the last complete version; an empty subject or body is not saved.
    if (next.subject.trim() && next.body.trim()) {
      autosave.schedule(id, next);
      return;
    }
    void autosave.discard(id);
  };
  const showVersion = (id: string, text: Partial<DispatchDraft>) => {
    review.replace(id, text);
    setEdits(({ [id]: _dropped, ...rest }) => rest);
  };
  // Runs from the toast, which may outlive the sheet.
  const restore = async (id: string, previous: DraftText) => {
    try {
      await updateDraft({ data: { id, ...previous } });
      showVersion(id, previous);
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };

  const rewrite = useMutation({
    mutationFn: async ({ id }: { id: string; previous: DraftText }) => {
      await autosave.flush();
      return rewriteDraft({ data: { id } });
    },
    onSuccess: (draft, { id, previous }) => {
      if (!draft) return;
      showVersion(id, draft);
      toast("Nova versão gerada", {
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void restore(id, previous) },
      });
    },
    onError: errorToast("Não foi possível reescrever"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await autosave.discard(id);
      return removeDraft({ data: { id } });
    },
    onSuccess: (_result, id) => review.drop(id),
    onError: errorToast("Não foi possível tirar do disparo"),
  });
  const automation = useMutation({
    mutationFn: (aiAutoReply: boolean) => setAutomation({ data: { aiAutoReply } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["autopilot"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]),
    onError: errorToast("Não foi possível mudar a resposta automática"),
  });
  // A draft being removed or rewritten is still in `drafts`; dispatching now would send it.
  // While the AI writes, the new drafts are not in `drafts` yet and would be left out.
  const busy = remove.isPending || rewrite.isPending || review.writing;
  const dispatch = useMutation({
    mutationFn: async () => {
      await autosave.flush();
      // Also surfaces an edit that could not be saved (e.g. an empty subject) before sending.
      for (const [id, text] of Object.entries(edits)) {
        await updateDraft({ data: { id, ...text } });
      }
      return dispatchEmails({ data: { ids: drafts.map((draft) => draft.id) } });
    },
    onSuccess: async ({ queued }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
        queryClient.invalidateQueries({ queryKey: ["cold-room"] }),
      ]);
      toast.success(`${queued} ${queued === 1 ? "e-mail na fila" : "e-mails na fila"}`, {
        description: `Um a cada ${SEND_GAP_MINUTES} minutos. As respostas aparecem em Conversas.`,
      });
      onDispatched();
      onClose();
    },
    onError: errorToast("Não foi possível disparar"),
  });

  const mail = status?.mail;
  // First e-mails stop at the cold limit (the rest is kept for replies), after those queued.
  const remaining = coldRoom ? coldRemaining(coldRoom) : 0;
  const aiAutoReply = automation.isPending
    ? automation.variables
    : (automationSettings?.aiAutoReply ?? true);

  return (
    <>
      <SheetHeader className="gap-1 px-5 pt-4 pb-3 pr-14">
        <SheetTitle className="flex items-center gap-2 text-lg">
          {review.writing ? <LoaderCircleIcon className="size-4 animate-spin text-purple" /> : null}
          {reviewTitle({ writing: review.writing, count: drafts.length })}
        </SheetTitle>
        <SheetDescription>
          A IA só escreve quando você pede. Revise cada e-mail antes de enviar.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {review.missing.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-fill-2 px-4 py-3">
            <p className="flex-1 text-sm font-light text-muted-foreground">
              {missingLine(review.missing.length)}
            </p>
            <Button variant="outline" size="sm" disabled={review.writing} onClick={review.write}>
              <SparklesIcon className="text-purple" />
              {review.writing ? "Escrevendo…" : writeDraftsLabel(review.missing.length)}
            </Button>
          </div>
        ) : null}
        {review.loadFailed ? (
          <p className="mb-4 text-sm font-light text-orange">
            Não foi possível carregar os e-mails já escritos.
          </p>
        ) : null}
        {review.loading || review.writing ? (
          <div className="grid gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : current && value ? (
          <div className="grid gap-3.5">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="flex rounded-full bg-fill-2 p-0.5">
                <Hint label="Anterior">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Anterior"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => i - 1)}
                  >
                    <ChevronLeftIcon />
                  </Button>
                </Hint>
                <Hint label="Próximo">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Próximo"
                    disabled={index >= drafts.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                  >
                    <ChevronRightIcon />
                  </Button>
                </Hint>
              </div>
              <span className="font-medium text-muted-foreground tabular-nums">
                {index + 1} de {drafts.length}
              </span>
              <span className="truncate font-medium">{current.leadName}</span>
              {drafts.length > 1 ? (
                <span className="ml-auto flex gap-1" aria-hidden>
                  {drafts.map((draft, i) => (
                    <span
                      key={draft.id}
                      className={cn(
                        "size-1.5 rounded-full",
                        i === index ? "bg-foreground" : "bg-quaternary",
                      )}
                    />
                  ))}
                </span>
              ) : null}
            </div>

            <div className="grouped">
              <div className="grouped-row flex min-h-[42px] items-center gap-3 px-4 [--inset:16px]">
                <span className="w-10 font-light text-tertiary">De</span>
                <span className="truncate font-medium">
                  {mail?.address || "caixa não conectada"}
                </span>
              </div>
              <div className="grouped-row flex min-h-[42px] items-center gap-3 px-4 [--inset:16px]">
                <span className="w-10 font-light text-tertiary">Para</span>
                <Badge variant="gray" className="text-foreground">
                  <Avatar name={current.leadName} size={16} />
                  {current.toAddress}
                </Badge>
                <Badge variant="purple" className="ml-auto">
                  <SparklesIcon />
                  Escrito pela IA
                </Badge>
              </div>
              <div className="grouped-row grid gap-1 px-4 pt-3 pb-4 [--inset:16px]">
                <label htmlFor="draft-subject" className="sr-only">
                  Assunto
                </label>
                <Input
                  id="draft-subject"
                  autoComplete="off"
                  value={value.subject}
                  readOnly={rewrite.isPending}
                  className="h-auto bg-transparent! px-0 text-lg font-medium tracking-[-0.02em] shadow-none! focus-visible:ring-0"
                  onChange={(event) => edit(current.id, { ...value, subject: event.target.value })}
                />
                <label htmlFor="draft-body" className="sr-only">
                  Mensagem
                </label>
                <Textarea
                  id="draft-body"
                  rows={12}
                  value={value.body}
                  readOnly={rewrite.isPending}
                  className="bg-transparent! px-0 text-base leading-[1.7] shadow-none! focus-visible:ring-0"
                  onChange={(event) => edit(current.id, { ...value, body: event.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={rewrite.isPending}
                onClick={() => rewrite.mutate({ id: current.id, previous: value })}
              >
                <SparklesIcon className="text-purple" />
                {rewrite.isPending ? "Reescrevendo…" : "Gerar outro"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(current.id);
                  setIndex((i) => Math.max(0, i - 1));
                }}
              >
                Tirar do disparo
              </Button>
              <SaveStatus state={autosave.state} className="ml-auto self-center" />
            </div>
          </div>
        ) : (
          <p className="text-sm font-light text-muted-foreground">Nenhum e-mail escrito ainda.</p>
        )}

        <div className="mt-5">
          <DispatchRecipients
            recipients={recipients}
            draftLeadIds={new Set(drafts.map((draft) => draft.leadId))}
            skippedLeadIds={new Set(skipped.map((skip) => skip.leadId))}
          />
        </div>

        {skipped.length > 0 ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--orange)_10%,transparent)] px-4 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--orange)_22%,transparent)]">
            <IconTile icon={TriangleAlertIcon} tone="orange" size={26} />
            <div className="grid gap-0.5 text-sm">
              <p className="font-medium text-orange">Ficaram de fora</p>
              {skipped.map((skip) => (
                <p key={skip.leadId} className="font-light text-muted-foreground">
                  {skip.name}: {skip.reason}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <SheetFooter className="gap-3 border-t border-border/70 bg-black/[0.02] px-5 pt-3.5 pb-5 dark:bg-black/20">
        <div className="grouped">
          <PropertyRow label="Envio">um a cada {SEND_GAP_MINUTES} min</PropertyRow>
          <PropertyRow label="Restam hoje">
            <span className="text-green">{remaining}</span> de {coldRoom?.coldLimit ?? 0}
            {drafts.length > remaining ? (
              <span className="font-light text-orange"> (o resto sai amanhã)</span>
            ) : null}
          </PropertyRow>
          <div className="grouped-row flex min-h-[46px] items-center gap-3 px-4 [--inset:16px]">
            <IconTile icon={SparklesIcon} tone="purple" size={26} />
            {/* The global setting, not one for this batch: said so, since it sits in a send. */}
            <label htmlFor="dispatch-ai" className="grid flex-1 gap-0.5 py-2">
              <span className="font-medium">IA responde sozinha até haver interesse</span>
              <span className="text-[14px] font-light text-muted-foreground">
                Vale para todas as conversas, não só para este disparo.
              </span>
            </label>
            <Switch
              id="dispatch-ai"
              checked={aiAutoReply}
              disabled={automation.isPending}
              style={{ "--switch-on": "var(--purple)" }}
              onCheckedChange={(checked) => automation.mutate(checked)}
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={drafts.length === 0 || dispatch.isPending || busy || !mail?.configured}
          onClick={() => dispatch.mutate()}
        >
          <SendIcon />
          {dispatchLabel({
            mailConfigured: Boolean(mail?.configured),
            dispatching: dispatch.isPending,
            removing: remove.isPending,
            rewriting: rewrite.isPending,
            count: drafts.length,
          })}
        </Button>
      </SheetFooter>
    </>
  );
}

/** The sheet's title: what is going on, then how many e-mails would go. */
function reviewTitle(state: { writing: boolean; count: number }): string {
  if (state.writing) return "Escrevendo os e-mails…";
  if (state.count === 0) return "Revisar disparo";
  return `Disparar ${state.count} ${state.count === 1 ? "e-mail" : "e-mails"}`;
}

/** The line next to "Escrever": how many recipients still have no e-mail. */
function missingLine(count: number): string {
  if (count === 1) return "1 destinatário ainda sem e-mail escrito.";
  return `${count} destinatários ainda sem e-mail escrito.`;
}

/** The dispatch button's text, which also says why it is off. */
function dispatchLabel(state: {
  mailConfigured: boolean;
  dispatching: boolean;
  removing: boolean;
  rewriting: boolean;
  count: number;
}): string {
  if (!state.mailConfigured) return "Caixa de e-mail ainda não conectada";
  if (state.dispatching) return "Colocando na fila…";
  if (state.removing) return "Tirando do disparo…";
  if (state.rewriting) return "Gerando outra versão…";
  return `Disparar ${state.count} ${state.count === 1 ? "e-mail" : "e-mails"}`;
}
