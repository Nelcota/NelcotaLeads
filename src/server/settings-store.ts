import { and, eq, getTableColumns, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";
import type { DispatchControl } from "@/lib/send-window";
import {
  autopilotInputSchema,
  DEFAULT_CRITERIA,
  DEFAULT_SEND_WINDOW,
  sendWindowInputSchema,
  settingsInputSchema,
  type AutopilotInput,
  type AutopilotTarget,
  type SettingsInput,
} from "@/lib/schemas";

export const SETTINGS_ID = 1;

export const DEFAULT_SETTINGS: SettingsInput = {
  offer: "",
  idealCustomer: "",
  criteria: DEFAULT_CRITERIA,
  tone: "consultivo",
  senderName: "",
  senderCompany: "",
  minScore: 30,
};

export type AutopilotSettings = Omit<AutopilotInput, "targets" | "aiAutoReply" | "autoDispatch"> & {
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

const autopilotTargetSchema = z.object({
  niche: z.string().trim().min(1),
  city: z.string().trim().min(1),
  areas: z.array(z.string()).catch([]),
  cursor: z.number().int().min(0).catch(0),
});

/** Everything stored in the settings row, each field validated on the way out. */
export type StoredConfig = {
  settings: SettingsInput;
  autopilot: AutopilotSettings;
  aiAutoReply: boolean;
  autoDispatch: boolean;
};

export const DEFAULT_CONFIG: StoredConfig = {
  settings: DEFAULT_SETTINGS,
  autopilot: DEFAULT_AUTOPILOT,
  aiAutoReply: true,
  autoDispatch: false,
};

/**
 * Reads the settings row once. Each field is parsed on its own and falls back to its
 * default when the stored value is corrupted, so one bad column (or a JSON column that
 * does not even parse) never breaks every lead and every tick.
 */
export async function loadConfig(db: Db): Promise<StoredConfig> {
  const [row] = await db
    .select({
      ...getTableColumns(settings),
      // Raw text: a column holding invalid JSON must not throw while mapping the row.
      criteria: sql<unknown>`${settings.criteria}`,
      autopilotTargets: sql<unknown>`${settings.autopilotTargets}`,
    })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .limit(1);
  if (!row) return DEFAULT_CONFIG;

  const fields = settingsInputSchema.shape;
  const autopilotFields = autopilotInputSchema.shape;
  return {
    settings: {
      offer: field(fields.offer, row.offer, DEFAULT_SETTINGS.offer),
      idealCustomer: field(fields.idealCustomer, row.idealCustomer, DEFAULT_SETTINGS.idealCustomer),
      criteria: field(fields.criteria, parseJson(row.criteria), DEFAULT_SETTINGS.criteria),
      tone: field(fields.tone, row.tone, DEFAULT_SETTINGS.tone),
      senderName: field(fields.senderName, row.senderName, DEFAULT_SETTINGS.senderName),
      senderCompany: field(fields.senderCompany, row.senderCompany, DEFAULT_SETTINGS.senderCompany),
      minScore: field(fields.minScore, row.minScore, DEFAULT_SETTINGS.minScore),
    },
    autopilot: {
      enabled: field(autopilotFields.enabled, row.autopilotEnabled, DEFAULT_AUTOPILOT.enabled),
      hour: field(autopilotFields.hour, row.autopilotHour, DEFAULT_AUTOPILOT.hour),
      results: field(autopilotFields.results, row.autopilotResults, DEFAULT_AUTOPILOT.results),
      targets: parseTargets(parseJson(row.autopilotTargets)),
      lastRunOn: field(lastRunOnSchema, row.autopilotLastRunOn, DEFAULT_AUTOPILOT.lastRunOn),
    },
    aiAutoReply: field(autopilotFields.aiAutoReply, row.aiAutoReply, DEFAULT_CONFIG.aiAutoReply),
    autoDispatch: field(
      autopilotFields.autoDispatch,
      row.autoDispatch,
      DEFAULT_CONFIG.autoDispatch,
    ),
  };
}

const lastRunOnSchema = z.string().nullable();

function field<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Keeps the targets that still make sense; a broken entry never drops the others. */
function parseTargets(value: unknown): AutopilotTarget[] {
  if (!Array.isArray(value)) return DEFAULT_AUTOPILOT.targets;
  return value.flatMap((item) => {
    const parsed = autopilotTargetSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const pausedAtSchema = z.date().nullable();

/**
 * The send window and the pause switch, read on every send. A stored window that makes no
 * sense (start not before end) falls back to the default, so sending never stops for good.
 */
export async function loadDispatchControl(db: Db): Promise<DispatchControl> {
  const [row] = await db
    .select({
      start: settings.sendWindowStart,
      end: settings.sendWindowEnd,
      pausedAt: settings.dispatchPausedAt,
    })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .limit(1);
  if (!row) return { ...DEFAULT_SEND_WINDOW, pausedAt: null };
  const window = sendWindowInputSchema.safeParse({ start: row.start, end: row.end });
  return {
    ...(window.success ? window.data : DEFAULT_SEND_WINDOW),
    pausedAt: field(pausedAtSchema, row.pausedAt, null),
  };
}

export async function writeDispatchControl(
  db: Db,
  changes: Partial<
    Pick<
      typeof settings.$inferInsert,
      "sendWindowStart" | "sendWindowEnd" | "dispatchPausedAt" | "dispatchCancelledOn"
    >
  >,
) {
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...changes })
    .onConflictDoUpdate({ target: settings.id, set: changes });
}

export async function loadSettings(db: Db): Promise<SettingsInput> {
  return (await loadConfig(db)).settings;
}

export async function storeSettings(db: Db, input: SettingsInput) {
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...input })
    .onConflictDoUpdate({ target: settings.id, set: { ...input, updatedAt: new Date() } });
}

export async function loadAutopilot(db: Db): Promise<AutopilotSettings> {
  return (await loadConfig(db)).autopilot;
}

/**
 * Atomically claims today's autopilot run. Returns false when today already ran (or
 * there is nothing configured), so overlapping ticks and "run now" never search twice.
 */
export async function claimAutopilotDay(db: Db, today: string): Promise<boolean> {
  const rows = await db
    .update(settings)
    .set({ autopilotLastRunOn: today })
    .where(
      and(
        eq(settings.id, SETTINGS_ID),
        or(isNull(settings.autopilotLastRunOn), ne(settings.autopilotLastRunOn, today)),
      ),
    )
    .returning({ id: settings.id });
  return rows.length > 0;
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
    aiAutoReply: input.aiAutoReply,
    autoDispatch: input.autoDispatch,
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
      | "aiAutoReply"
      | "autoDispatch"
    >
  >,
) {
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...changes })
    .onConflictDoUpdate({ target: settings.id, set: changes });
}
