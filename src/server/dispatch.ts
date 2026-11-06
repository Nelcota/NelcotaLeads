import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { sendWindowInputSchema } from "@/lib/schemas";
import {
  cancelTodaysDispatch as cancelQueuedRun,
  pauseDispatch as pauseRun,
  resumeDispatch as resumeRun,
  saveSendWindow as storeSendWindow,
} from "./dispatch-control";
import { requestUserId } from "./request-user";
import { loadDispatchControl } from "./settings-store";

/** "Pausar" on the overview: first e-mails and follow-ups wait; conversations keep going. */
export const pauseDispatch = createServerFn({ method: "POST" }).handler(async () => {
  await pauseRun(getDb(), new Date());
  return { ok: true as const };
});

export const resumeDispatch = createServerFn({ method: "POST" }).handler(async () => {
  await resumeRun(getDb());
  return { ok: true as const };
});

/** "Cancelar disparo": cancels the first e-mails that did not go out yet; returns how many. */
export const cancelTodaysDispatch = createServerFn({ method: "POST" }).handler(async () => {
  const cancelled = await cancelQueuedRun(getDb(), new Date(), await requestUserId());
  return { cancelled };
});

/** The hours (Brazil time) first e-mails and follow-ups go out, for Configurações. */
export const getSendWindow = createServerFn({ method: "GET" }).handler(async () => {
  const { start, end } = await loadDispatchControl(getDb());
  return { start, end };
});

export const saveSendWindow = createServerFn({ method: "POST" })
  .validator(sendWindowInputSchema)
  .handler(async ({ data }) => {
    await storeSendWindow(getDb(), data);
    return { ok: true as const };
  });
