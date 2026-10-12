import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SendIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { Avatar, IconTile, PropertyRow } from "@/components/apple-ui";
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
import { dashboardQuery, providerStatusQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { setAutomation } from "@/server/dashboard";
import {
  dispatchEmails,
  prepareEmails,
  removeDraft,
  rewriteDraft,
  updateDraft,
} from "@/server/mail";

type Draft = Awaited<ReturnType<typeof prepareEmails>>["drafts"][number];
type Skip = Awaited<ReturnType<typeof prepareEmails>>["skipped"][number];

/**
 * Review step of a send: the AI writes one e-mail per selected lead, the user can edit,
 * rewrite or drop each one, then everything goes to the spaced-out send queue.
 */
export function DispatchSheet({
  leadIds,
  open,
  onOpenChange,
  onDispatched,
}: {
  leadIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatched: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-[620px]">
        {open ? (
          <DispatchReview
            leadIds={leadIds}
            onClose={() => onOpenChange(false)}
            onDispatched={onDispatched}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DispatchReview({
  leadIds,
  onClose,
  onDispatched,
}: {
  leadIds: string[];
  onClose: () => void;
  onDispatched: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery(providerStatusQuery);
  const { data: dashboard } = useQuery(dashboardQuery);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [skipped, setSkipped] = useState<Skip[]>([]);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [index, setIndex] = useState(0);

  const prepare = useMutation({
    mutationFn: () => prepareEmails({ data: { leadIds } }),
    onSuccess: (result) => {
      setDrafts(result.drafts);
      setSkipped(result.skipped);
    },
    onError: errorToast("A IA não conseguiu escrever os e-mails"),
  });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    prepare.mutate();
  }, [prepare]);

  const current = drafts[Math.min(index, drafts.length - 1)];
  const value = current
    ? (edits[current.id] ?? { subject: current.subject, body: current.body })
    : null;

  const rewrite = useMutation({
    mutationFn: (id: string) => rewriteDraft({ data: { id } }),
    onSuccess: (draft) => {
      if (!draft) return;
      setDrafts((list) =>
        list.map((item) => (item.id === draft.id ? { ...item, ...draft } : item)),
      );
      setEdits(({ [draft.id]: _dropped, ...rest }) => rest);
    },
    onError: errorToast("Não foi possível reescrever"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeDraft({ data: { id } }),
    onSuccess: (_result, id) => setDrafts((list) => list.filter((item) => item.id !== id)),
    onError: errorToast("Não foi possível tirar do disparo"),
  });
  const automation = useMutation({
    mutationFn: (aiAutoReply: boolean) => setAutomation({ data: { aiAutoReply } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    onError: errorToast("Não foi possível mudar a resposta automática"),
  });
  const dispatch = useMutation({
    mutationFn: async () => {
      for (const [id, edit] of Object.entries(edits)) {
        await updateDraft({ data: { id, ...edit } });
      }
      return dispatchEmails({ data: { ids: drafts.map((draft) => draft.id) } });
    },
    onSuccess: async ({ queued }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
      ]);
      toast.success(`${queued} ${queued === 1 ? "e-mail na fila" : "e-mails na fila"}`, {
        description: "Um a cada 8 minutos. As respostas aparecem em Conversas.",
      });
      onDispatched();
      onClose();
    },
    onError: errorToast("Não foi possível disparar"),
  });

  const mail = status?.mail;
  const remaining = mail ? Math.max(0, mail.limit - mail.sentToday) : 0;
  const aiAutoReply = automation.isPending
    ? automation.variables
    : (dashboard?.mail.aiAutoReply ?? true);

  return (
    <>
      <SheetHeader className="gap-1 px-5 pt-4 pb-3 pr-14">
        <SheetTitle className="flex items-center gap-2 text-lg">
          {prepare.isPending ? <SparklesIcon className="size-4 animate-pulse text-purple" /> : null}
          {prepare.isPending
            ? "Escrevendo os e-mails…"
            : `Disparar ${drafts.length} ${drafts.length === 1 ? "e-mail" : "e-mails"}`}
        </SheetTitle>
        <SheetDescription>
          Cada e-mail é escrito pela IA para a empresa. Revise antes de enviar.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {prepare.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : current && value ? (
          <div className="grid gap-3.5">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="flex rounded-full bg-fill-2 p-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Anterior"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Próximo"
                  disabled={index >= drafts.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  <ChevronRightIcon />
                </Button>
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
                  value={value.subject}
                  className="h-auto bg-transparent! px-0 text-lg font-medium tracking-[-0.02em] shadow-none! focus-visible:ring-0"
                  onChange={(event) =>
                    setEdits((all) => ({
                      ...all,
                      [current.id]: { ...value, subject: event.target.value },
                    }))
                  }
                />
                <label htmlFor="draft-body" className="sr-only">
                  Mensagem
                </label>
                <Textarea
                  id="draft-body"
                  rows={12}
                  value={value.body}
                  className="bg-transparent! px-0 text-base leading-[1.7] shadow-none! focus-visible:ring-0"
                  onChange={(event) =>
                    setEdits((all) => ({
                      ...all,
                      [current.id]: { ...value, body: event.target.value },
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={rewrite.isPending}
                onClick={() => rewrite.mutate(current.id)}
              >
                <SparklesIcon className="text-purple" />
                {rewrite.isPending ? "Reescrevendo…" : "Gerar outro"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-red/15 hover:text-red"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(current.id);
                  setIndex((i) => Math.max(0, i - 1));
                }}
              >
                Tirar do disparo
              </Button>
            </div>
          </div>
        ) : !prepare.isPending ? (
          <p className="text-sm font-light text-muted-foreground">Nenhum e-mail para revisar.</p>
        ) : null}

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
          <PropertyRow label="Envio">um a cada 8 min</PropertyRow>
          <PropertyRow label="Restam hoje">
            <span className="text-green">{remaining}</span> de {mail?.limit ?? 0}
            {drafts.length > remaining ? (
              <span className="font-light text-orange"> (o resto sai amanhã)</span>
            ) : null}
          </PropertyRow>
          <div className="grouped-row flex min-h-[46px] items-center gap-3 px-4 [--inset:16px]">
            <IconTile icon={SparklesIcon} tone="purple" size={26} />
            <label htmlFor="dispatch-ai" className="flex-1 font-medium">
              IA responde sozinha até haver interesse
            </label>
            <Switch
              id="dispatch-ai"
              checked={aiAutoReply}
              style={{ "--switch-on": "var(--purple)" }}
              onCheckedChange={(checked) => automation.mutate(checked)}
            />
          </div>
        </div>
        <Button
          size="lg"
          className="w-full"
          disabled={drafts.length === 0 || dispatch.isPending || !mail?.configured}
          onClick={() => dispatch.mutate()}
        >
          <SendIcon />
          {!mail?.configured
            ? "Conecte o e-mail nas Configurações"
            : dispatch.isPending
              ? "Colocando na fila…"
              : `Disparar ${drafts.length} ${drafts.length === 1 ? "e-mail" : "e-mails"}`}
        </Button>
      </SheetFooter>
    </>
  );
}
