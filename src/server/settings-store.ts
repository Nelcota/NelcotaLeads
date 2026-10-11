import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";
import {
  DEFAULT_CRITERIA,
  type AutopilotInput,
  type AutopilotTarget,
  type SettingsInput,
} from "@/lib/schemas";

const SETTINGS_ID = 1;

export const DEFAULT_SETTINGS: SettingsInput = {
  offer: "",
  idealCustomer: "",
  criteria: DEFAULT_CRITERIA,
  tone: "consultivo",
  senderName: "",
  senderCompany: "",
  minScore: 30,
};

export type AutopilotSettings = Omit<AutopilotInput, "targets"> & {
  targets: AutopilotTarget[];
  lastRunOn: string | null;
};

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  hour: 8,
  results: 20,
  targets: [],
  lastRunOn: null,
};

function loadRow(db: Db) {
  return db.query.settings.findFirst({ where: eq(settings.id, SETTINGS_ID) });
}

export async function loadSettings(db: Db): Promise<SettingsInput> {
  const row = await loadRow(db);
  if (!row) return DEFAULT_SETTINGS;
  return {
    offer: row.offer,
    idealCustomer: row.idealCustomer,
    criteria: row.criteria,
    tone: row.tone,
    senderName: row.senderName,
    senderCompany: row.senderCompany,
    minScore: row.minScore,
  };
}

export async function storeSettings(db: Db, input: SettingsInput) {
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...input })
    .onConflictDoUpdate({ target: settings.id, set: { ...input, updatedAt: new Date() } });
}

export async function loadAutopilot(db: Db): Promise<AutopilotSettings> {
  const row = await loadRow(db);
  if (!row) return DEFAULT_AUTOPILOT;
  return {
    enabled: row.autopilotEnabled,
    hour: row.autopilotHour,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- column only ever holds 20, 40 or 60
    results: row.autopilotResults as AutopilotSettings["results"],
    targets: row.autopilotTargets,
    lastRunOn: row.autopilotLastRunOn,
  };
}

/** Saves the autopilot form, keeping each existing target's area rotation. */
export async function storeAutopilot(db: Db, input: AutopilotInput) {
  const current = await loadAutopilot(db);
  const targets = input.targets.map(
    (target) =>
      current.targets.find(
        (old) =>
          old.niche.toLowerCase() === target.niche.toLowerCase() &&
          old.city.toLowerCase() === target.city.toLowerCase(),
      ) ?? { ...target, areas: [], cursor: 0 },
  );
  await writeAutopilot(db, {
    autopilotEnabled: input.enabled,
    autopilotHour: input.hour,
    autopilotResults: input.results,
    autopilotTargets: targets,
  });
}

export async function writeAutopilot(
  db: Db,
  changes: Partial<
    Pick<
      typeof settings.$inferInsert,
      | "autopilotEnabled"
      | "autopilotHour"
      | "autopilotResults"
      | "autopilotTargets"
      | "autopilotLastRunOn"
    >
  >,
) {
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...changes })
    .onConflictDoUpdate({ target: settings.id, set: changes });
}
