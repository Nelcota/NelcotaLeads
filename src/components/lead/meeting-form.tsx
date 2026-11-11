import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brazilInstant } from "@/lib/format";
import {
  defaultMeetingForm,
  MEETING_NOTE_MAX,
  meetingFromForm,
  type MeetingDraft,
  type MeetingForm as MeetingFields,
} from "@/lib/meetings";
import { meetingInviteEmail, SALES_EMAILS_OFF, type EmailText } from "@/lib/sales-email";
import { isCalendarDay, MEETING_KIND_LABELS, MEETING_KINDS } from "@/lib/schemas";
import { ChoiceChip } from "./choice-chip";
import { EmailPreview } from "./email-preview";

/**
 * "Agendar reunião": day, time (Brasília), kind, an optional note and whether the invite goes
 * by e-mail. With sending off, the invite text is shown to copy instead.
 */
export function MeetingForm({
  leadName,
  hasEmail,
  emailsEnabled,
  today,
  busy,
  onConfirm,
  onCopy,
  onBack,
}: {
  leadName: string;
  hasEmail: boolean;
  emailsEnabled: boolean;
  today: string;
  busy: boolean;
  onConfirm: (draft: MeetingDraft) => void;
  onCopy: (email: EmailText) => void;
  onBack: () => void;
}) {
  const canEmail = emailsEnabled && hasEmail;
  const [form, setForm] = useState<MeetingFields>(() => defaultMeetingForm(today, canEmail));
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<MeetingFields>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = meetingFromForm(
      { ...form, sendInvite: canEmail && form.sendInvite },
      new Date(),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirm(result.value);
  };
  const invite = invitePreview(leadName, form);

  return (
    <form className="grid w-full gap-3" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="meeting-day">Dia</Label>
          <Input
            id="meeting-day"
            type="date"
            min={today}
            className="tabular-nums"
            value={form.day}
            onChange={(event) => change({ day: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="meeting-time">Horário</Label>
          <Input
            id="meeting-time"
            type="time"
            step={300}
            className="tabular-nums"
            value={form.time}
            onChange={(event) => change({ time: event.target.value })}
          />
        </div>
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Como</legend>
        <div role="radiogroup" aria-label="Como" className="flex flex-wrap gap-1.5">
          {MEETING_KINDS.map((kind) => (
            <ChoiceChip
              key={kind}
              label={MEETING_KIND_LABELS[kind]}
              selected={form.kind === kind}
              onSelect={() => change({ kind })}
            />
          ))}
        </div>
      </fieldset>
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
      <InviteChoice
        checked={canEmail && form.sendInvite}
        disabled={!canEmail}
        note={canEmail ? null : hasEmail ? SALES_EMAILS_OFF : "Este lead não tem e-mail"}
        onChange={(sendInvite) => change({ sendInvite })}
      />
      {invite && !(canEmail && form.sendInvite) ? (
        <EmailPreview email={invite} emailsEnabled={emailsEnabled} onCopy={onCopy} />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Marcar reunião"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}

/** The invite as the lead would get it, once the day and time are complete. */
function invitePreview(leadName: string, form: MeetingFields): EmailText | null {
  if (!isCalendarDay(form.day) || !/^\d{2}:\d{2}$/.test(form.time)) return null;
  const startsAt = brazilInstant(form.day, form.time);
  if (Number.isNaN(startsAt.getTime())) return null;
  return meetingInviteEmail({ leadName, startsAt, kind: form.kind, note: form.note.trim() });
}

function InviteChoice({
  checked,
  disabled,
  note,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  note: string | null;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2.5">
        <Checkbox
          id="meeting-invite"
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onChange(value === true)}
        />
        <Label htmlFor="meeting-invite" className="font-normal">
          Mandar o convite por e-mail para o lead
        </Label>
      </div>
      {note ? <p className="pl-7 text-sm text-orange">{note}</p> : null}
    </div>
  );
}
