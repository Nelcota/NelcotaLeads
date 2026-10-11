import { createServerFn } from "@tanstack/react-start";
import { getDb } from "@/db/client";
import { settingsInputSchema } from "@/lib/schemas";
import { loadSettings, storeSettings } from "./settings-store";

export const getSettings = createServerFn({ method: "GET" }).handler(() => loadSettings(getDb()));

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator(settingsInputSchema)
  .handler(async ({ data }) => {
    await storeSettings(getDb(), data);
    return { ok: true as const };
  });
