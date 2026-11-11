import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AgendaActions } from "@/hooks/use-agenda-actions";
import { longDay, type CalendarEntry } from "@/lib/calendar";
import { MEETING_NOTE_MAX, meetingFromForm, type MeetingForm } from "@/lib/meetings";
import { bookableLeadsQuery } from "@/lib/queries";
import { MEETING_KIND_LABELS, MEETING_KINDS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { EntryIcon } from "./entry-icon";
import { LeadPicker } from "./lead-picker";
import { AGENDA_DIALOG, CloseButton } from "./meeting-detail";
import { DayField, TimeField } from "./when-fields";

/** What the dialog does: book a new meeting, or move one that exists. */
export type MeetingTarget =
  | { mode: "book"; day: string; time: string; leadId: string }
  | { mode: "reschedule"; entry: CalendarEntry; day: string; time: string };

/**
 * "Nova reunião" (lead, day, time, kind, note, invite) and "Remarcar reunião" (day and time of an
 * existing meeting). Days before today cannot be picked; the server checks the time again.
 */
export function MeetingDialog({
  target,
  today,
  busyDays,
  actions,
  onClose,
}: {
  target: MeetingTarget;
  today: string;
  busyDays: ReadonlySet<string>;
  actions: AgendaActions;
  onClose: () => void;
}) {
  const bookable = useQuery({ ...bookableLeadsQuery, enabled: target.mode === "book" });
  const leads = bookable.data?.leads ?? [];
  const [leadId, setLeadId] = useState(
    target.mode === "book" ? target.leadId : target.entry.leadId,
  );
  const [form, setForm] = useState<MeetingForm>({
    day: target.day,
    time: target.time,
    kind: target.mode === "reschedule" ? (target.entry.meetingKind ?? "video") : "video",
    note: "",
    sendInvite: false,
  });
  const [error, setError] = useState<string | null>(null);
  const lead = leads.find((item) => item.id === leadId);
  const canEmail = Boolean(bookable.data?.emailsEnabled && lead?.hasEmail);
  const rescheduling = target.mode === "reschedule";
  const change = (patch: Partial<MeetingForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!rescheduling && !leadId) {
      setError("Escolha o lead da reunião.");
      return;
    }
    const result = meetingFromForm(
      { ...form, sendInvite: canEmail && form.sendInvite },
      new Date(),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (target.mode === "reschedule") {
      const from = { day: target.entry.day, time: target.time };
      if (from.day === result.value.day && from.time === result.value.time) {
        onClose();
        return;
      }
      actions.reschedule(
        { id: target.entry.id, day: result.value.day, time: result.value.time, from },
        { onSuccess: onClose },
      );
      return;
    }
    actions.book({ leadId, ...result.value }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className={cn(AGENDA_DIALOG, "sm:max-w-[420px]")}>
        <form onSubmit={submit} className="grid gap-3.5">
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <DialogTitle className="text-lg font-semibold">
                {rescheduling ? "Remarcar reunião" : "Nova reunião"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {longDay(form.day)} · 30 min
              </DialogDescription>
            </div>
            <CloseButton onClose={onClose} />
          </div>
          {rescheduling ? (
            <p className="rounded-[14px] border border-border bg-card px-3.5 py-2.5 text-sm font-semibold">
              {target.entry.leadName}
            </p>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="meeting-lead">Lead</Label>
              <LeadPicker
                leads={leads}
                value={leadId}
                invalid={error === "Escolha o lead da reunião."}
                onChange={(next) => {
                  setLeadId(next);
                  setError(null);
                }}
              />
            </div>
          )}
          <DayField
            value={form.day}
            today={today}
            busyDays={busyDays}
            onChange={(day) => change({ day })}
          />
          <TimeField value={form.time} onChange={(time) => change({ time })} />
          {rescheduling ? null : (
            <>
              <KindChips value={form.kind} onChange={(kind) => change({ kind })} />
              <div className="grid gap-1.5">
                <Label htmlFor="meeting-note">Nota (opcional)</Label>
                <Textarea
                  id="meeting-note"
                  rows={2}
                  maxLength={MEETING_NOTE_MAX}
                  placeholder="Ex.: mostrar exemplos de sites de clínicas."
                  value={form.note}
                  onChange={(event) => change({ note: event.target.value })}
                />
              </div>
              <InviteCheck
                checked={canEmail && form.sendInvite}
                disabled={!canEmail}
                onChange={(sendInvite) => change({ sendInvite })}
              />
            </>
          )}
          {error ? <p className="text-sm text-red">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={actions.booking || actions.moving}>
              {rescheduling ? "Salvar" : "Marcar reunião"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KindChips({
  value,
  onChange,
}: {
  value: MeetingForm["kind"];
  onChange: (kind: MeetingForm["kind"]) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Como" className="flex flex-wrap gap-1.5">
      {MEETING_KINDS.map((kind) => (
        <ChoicePill
          key={kind}
          size="sm"
          role="radio"
          aria-checked={value === kind}
          selected={value === kind}
          onClick={() => onChange(kind)}
        >
          <EntryIcon
            kind={kind}
            className={value === kind ? "text-primary-foreground" : undefined}
          />
          {MEETING_KIND_LABELS[kind]}
        </ChoicePill>
      ))}
    </div>
  );
}

function InviteCheck({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-8 items-center gap-2.5 text-sm",
        disabled && "text-muted-foreground",
      )}
      title={disabled ? "Só sai com os e-mails de venda ligados e um lead com e-mail." : undefined}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
      />
      Enviar convite por e-mail ao lead
    </label>
  );
}
