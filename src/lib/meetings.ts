import { z } from "zod";
import { addDays, brazilInstant, isoWeekday } from "./format";
import { firstIssue, type ParseResult } from "./form-result";
import { daySchema, idSchema, isCalendarDay, MEETING_KINDS, type MeetingKind } from "./schemas";

export const MEETING_NOTE_MAX = 300;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "Agendar reunião": the Brazil day and time, the kind, a note and whether to e-mail the lead. */
export const meetingInputSchema = z.object({
  leadId: idSchema,
  day: daySchema,
  time: z.string().regex(TIME, "Horário inválido"),
  kind: z.enum(MEETING_KINDS),
  note: z
    .string()
    .normalize("NFC")
    .trim()
    .max(MEETING_NOTE_MAX, `Nota: até ${MEETING_NOTE_MAX} caracteres`),
  sendInvite: z.boolean(),
});
export type MeetingInput = z.infer<typeof meetingInputSchema>;

export const meetingCancelSchema = z.object({ id: idSchema });

export const PAST_MEETING_MESSAGE = "Escolha um dia e horário que ainda não passaram.";

/** The form's fields as typed. */
export type MeetingForm = {
  day: string;
  time: string;
  kind: MeetingKind;
  note: string;
  sendInvite: boolean;
};

export type MeetingDraft = Omit<MeetingInput, "leadId">;

/** Checks "Agendar reunião" in the browser; the server checks it again. */
export function meetingFromForm(form: MeetingForm, now: Date): ParseResult<MeetingDraft> {
  if (!isCalendarDay(form.day)) return { ok: false, error: "Informe o dia da reunião." };
  if (!TIME.test(form.time)) return { ok: false, error: "Informe o horário (HH:MM)." };
  if (brazilInstant(form.day, form.time) <= now) return { ok: false, error: PAST_MEETING_MESSAGE };
  const parsed = meetingInputSchema.omit({ leadId: true }).safeParse(form);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error.issues) };
  return { ok: true, value: parsed.data };
}

/** The meeting's form with tomorrow at 10:00 (the next weekday after a Friday). */
export function defaultMeetingForm(today: string, canEmail: boolean): MeetingForm {
  return {
    day: nextWorkday(today),
    time: "10:00",
    kind: "video",
    note: "",
    sendInvite: canEmail,
  };
}

function nextWorkday(today: string): string {
  const weekday = isoWeekday(today);
  // Friday → Monday (+3), Saturday → Monday (+2), otherwise the next day.
  const skip = weekday === 5 ? 3 : weekday === 6 ? 2 : 1;
  return addDays(today, skip);
}
