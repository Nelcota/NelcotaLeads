import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GaugeIcon,
  LoaderCircleIcon,
  MailIcon,
  PencilLineIcon,
  SendIcon,
  SparklesIcon,
  TimerIcon,
  TriangleAlertIcon,
} from "@/components/icons";
import { useState } from "react";
import { Avatar, Hint, IconTile, PropertyRow, SaveStatus } from "@/components/apple-ui";
import { IconLabel } from "@/components/icon-label";
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
import { useDispatchActions } from "@/hooks/use-dispatch-actions";
import { useDispatchDrafts } from "@/hooks/use-dispatch-drafts";
import { useDispatchSettings } from "@/hooks/use-dispatch-settings";
import { dispatchLabel, missingLine, reviewTitle, writeDraftsLabel } from "@/lib/dispatch-review";
import { SEND_GAP_MINUTES } from "@/lib/schemas";
import { cn } from "@/lib/utils";

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
  const review = useDispatchDrafts(recipients.map((recipient) => recipient.id));
  const { drafts, skipped } = review;
  const actions = useDispatchActions({
    review,
    onDispatched: () => {
      onDispatched();
      onClose();
    },
  });
  const settings = useDispatchSettings(drafts.length);
  const { mail, room } = settings;
  const [index, setIndex] = useState(0);

  const current = drafts[Math.min(index, drafts.length - 1)];
  const value = current ? actions.textOf(current) : null;

  return (
    <>
      <SheetHeader className="gap-1 px-5 pt-4 pb-3 pr-14">
        <SheetTitle className="flex items-center gap-2 text-lg">
          {review.writing ? (
            <LoaderCircleIcon className="size-4 animate-spin text-purple" />
          ) : (
            <SendIcon aria-hidden className="size-[18px] shrink-0 text-blue" />
          )}
          {reviewTitle({ writing: review.writing, count: drafts.length })}
        </SheetTitle>
        <SheetDescription>
          A IA só escreve quando você pede. Revise cada e-mail antes de enviar.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {!review.loading && review.missing.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-fill-2 px-4 py-3">
            <p className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
              <PencilLineIcon aria-hidden className="size-4 shrink-0 text-orange" />
              {missingLine(review.missing.length)}
            </p>
            <Button variant="outline" size="sm" disabled={review.writing} onClick={review.write}>
              <SparklesIcon className="text-purple" />
              {review.writing ? "Escrevendo…" : writeDraftsLabel(review.missing.length)}
            </Button>
          </div>
        ) : null}
        {review.loadFailed ? (
          <p className="mb-4 text-sm text-orange">
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
                <span className="w-16 shrink-0 text-tertiary">De</span>
                <span className="truncate font-medium">
                  {mail?.address || "caixa não conectada"}
                </span>
              </div>
              <div className="grouped-row flex min-h-[42px] items-center gap-3 px-4 [--inset:16px]">
                <span className="flex w-16 shrink-0 items-center gap-1.5 text-tertiary">
                  <MailIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  Para
                </span>
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
                  readOnly={actions.rewriting}
                  className="h-auto bg-transparent! px-0 text-lg font-medium tracking-[-0.02em] shadow-none! focus-visible:ring-0"
                  onChange={(event) =>
                    actions.edit(current.id, { ...value, subject: event.target.value })
                  }
                />
                <label htmlFor="draft-body" className="sr-only">
                  Mensagem
                </label>
                <Textarea
                  id="draft-body"
                  rows={12}
                  value={value.body}
                  readOnly={actions.rewriting}
                  className="bg-transparent! px-0 text-base leading-[1.7] shadow-none! focus-visible:ring-0"
                  onChange={(event) =>
                    actions.edit(current.id, { ...value, body: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={actions.rewriting}
                onClick={() => actions.rewrite(current.id, value)}
              >
                <SparklesIcon className="text-purple" />
                {actions.rewriting ? "Reescrevendo…" : "Gerar outro"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actions.removing}
                onClick={() => {
                  actions.remove(current);
                  setIndex((i) => Math.max(0, i - 1));
                }}
              >
                Tirar do disparo
              </Button>
              <SaveStatus state={actions.saveState} className="ml-auto self-center" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum e-mail escrito ainda.</p>
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
                <p key={skip.leadId} className="text-muted-foreground">
                  {skip.name}: {skip.reason}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <SheetFooter className="gap-3 border-t border-border/70 bg-black/[0.02] px-5 pt-3.5 pb-5 dark:bg-black/20">
        <div className="grouped">
          <PropertyRow label={<IconLabel icon={TimerIcon} text="Envio" />}>
            um a cada {SEND_GAP_MINUTES} min
          </PropertyRow>
          {settings.roomLoading ? (
            <PropertyRow label={<IconLabel icon={GaugeIcon} text="Restam hoje" />}>
              <Skeleton className="inline-block h-4 w-16 align-middle" />
            </PropertyRow>
          ) : null}
          {room ? (
            <PropertyRow label={<IconLabel icon={GaugeIcon} text="Restam hoje" />}>
              <span className="text-green">{room.remaining}</span> de {room.limit}
              {room.spillsOver ? <span className="text-orange"> (o resto sai amanhã)</span> : null}
            </PropertyRow>
          ) : null}
          <div className="grouped-row flex min-h-[46px] items-center gap-3 px-4 [--inset:16px]">
            <IconTile icon={SparklesIcon} tone="purple" size={26} />
            {/* The global setting, not one for this batch: said so, since it sits in a send. */}
            <label htmlFor="dispatch-ai" className="grid flex-1 gap-0.5 py-2">
              <span className="font-medium">IA responde sozinha até haver interesse</span>
              <span className="text-sm text-muted-foreground">
                Vale para todas as conversas, não só para este disparo.
              </span>
            </label>
            <Switch
              id="dispatch-ai"
              checked={settings.aiAutoReply}
              disabled={settings.aiAutoReplyChanging}
              style={{ "--switch-on": "var(--purple)" }}
              onCheckedChange={settings.setAiAutoReply}
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={drafts.length === 0 || actions.dispatching || actions.busy || !mail?.configured}
          onClick={actions.dispatch}
        >
          <SendIcon />
          {dispatchLabel({
            mailConfigured: Boolean(mail?.configured),
            dispatching: actions.dispatching,
            removing: actions.removing,
            rewriting: actions.rewriting,
            count: drafts.length,
          })}
        </Button>
      </SheetFooter>
    </>
  );
}
