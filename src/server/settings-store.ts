import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";
import { DEFAULT_CRITERIA, type SettingsInput } from "@/lib/schemas";

const SETTINGS_ID = 1;

export const DEFAULT_SETTINGS: SettingsInput = {
  offer: "",
  idealCustomer: "",
  criteria: DEFAULT_CRITERIA,
  tone: "consultivo",
  senderName: "",
  senderCompany: "",
  messageScoreThreshold: 60,
};

export async function loadSettings(db: Db): Promise<SettingsInput> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, SETTINGS_ID) });
  if (!row) return DEFAULT_SETTINGS;
  const { id: _id, updatedAt: _updatedAt, ...rest } = row;
  return rest;
}

export async function storeSettings(db: Db, input: SettingsInput) {
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...input })
    .onConflictDoUpdate({ target: settings.id, set: { ...input, updatedAt: new Date() } });
}
