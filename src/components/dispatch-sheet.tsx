import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
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
    onError: (error) => toast.error(error.message || "A IA não conseguiu escrever os e-mails"),
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
    onError: () => toast.error("Não foi possível reescrever"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeDraft({ data: { id } }),
    onSuccess: (_result, id) => setDrafts((list) => list.filter((item) => item.id !== id)),
  });
  const automation = useMutation({
    mutationFn: (aiAutoReply: boolean) => setAutomation({ data: { aiAutoReply } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
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
    onError: (error) => toast.error(error.message || "Não foi possível disparar"),
  });

  const mail = status?.mail;
  const remaining = mail ? Math.max(0, mail.limit - mail.sentToday) : 0;
  const aiAutoReply = automation.isPending
    ? automation.variables
    : (dashboard?.mail.aiAutoReply ?? true);

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>
          {prepare.isPending
            ? "Escrevendo os e-mails…"
            : `Disparar ${drafts.length} ${drafts.length === 1 ? "e-mail" : "e-mails"}`}
        </SheetTitle>
        <SheetDescription>
          Cada e-mail é escrito pela IA para a empresa. Revise antes de enviar.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {prepare.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : current && value ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">
                {index + 1} de {drafts.length} · {current.leadName}
              </span>
              <div className="flex">
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
            </div>
            <dl className="grid grid-cols-[4rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">De</dt>
              <dd className="truncate">{mail?.address || "caixa não conectada"}</dd>
              <dt className="text-muted-foreground">Para</dt>
              <dd className="truncate">{current.toAddress}</dd>
            </dl>
            <div className="grid gap-2">
              <Label htmlFor="draft-subject">Assunto</Label>
              <Input
                id="draft-subject"
                value={value.subject}
                onChange={(event) =>
                  setEdits((all) => ({
                    ...all,
                    [current.id]: { ...value, subject: event.target.value },
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="draft-body">Mensagem</Label>
              <Textarea
                id="draft-body"
                rows={12}
                value={value.body}
                onChange={(event) =>
                  setEdits((all) => ({
                    ...all,
                    [current.id]: { ...value, body: event.target.value },
                  }))
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={rewrite.isPending}
                onClick={() => rewrite.mutate(current.id)}
              >
                {rewrite.isPending ? "Reescrevendo…" : "Gerar outro"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
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
          <p className="text-sm text-muted-foreground">Nenhum e-mail para revisar.</p>
        ) : null}

        {skipped.length > 0 ? (
          <div className="mt-6 grid gap-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Ficaram de fora</p>
            {skipped.map((skip) => (
              <p key={skip.leadId}>
                {skip.name}: {skip.reason}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <SheetFooter className="gap-4 border-t">
        <dl className="grid gap-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Envio</dt>
            <dd>um a cada 8 min</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Restam hoje</dt>
            <dd>
              {remaining} de {mail?.limit ?? 0}
              {drafts.length > remaining ? " (o resto sai amanhã)" : ""}
            </dd>
          </div>
        </dl>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="dispatch-ai">IA responde sozinha até haver interesse</Label>
          <Switch
            id="dispatch-ai"
            checked={aiAutoReply}
            onCheckedChange={(checked) => automation.mutate(checked)}
          />
        </div>
        <Button
          size="lg"
          disabled={drafts.length === 0 || dispatch.isPending || !mail?.configured}
          onClick={() => dispatch.mutate()}
        >
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
