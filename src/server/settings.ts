import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { quickRepliesInputSchema, settingsInputSchema } from "@/lib/schemas";
import { loadQuickReplies, storeQuickReplies } from "./quick-replies";
import { loadSettings, storeSettings } from "./settings-store";

export const getSettings = createServerFn({ method: "GET" }).handler(() => loadSettings(getDb()));

export const saveSettings = createServerFn({ method: "POST" })
  .validator(settingsInputSchema)
  .handler(async ({ data }) => {
    await storeSettings(getDb(), data);
    return { ok: true as const };
  });

/** The "Respostas rápidas" the composer offers. */
export const getQuickReplies = createServerFn({ method: "GET" }).handler(() =>
  loadQuickReplies(getDb()),
);

export const saveQuickReplies = createServerFn({ method: "POST" })
  .validator(quickRepliesInputSchema)
  .handler(async ({ data }) => {
    await storeQuickReplies(getDb(), data.replies);
    return { ok: true as const };
  });
