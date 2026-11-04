import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { serviceAddons, services } from "@/db/schema";
import type { AddonInput, AddonUpdate, ServiceInput, ServiceUpdate } from "@/lib/services";

export const SERVICE_NOT_FOUND = "Serviço não encontrado. Atualize a página.";
export const ADDON_NOT_FOUND = "Adicional não encontrado. Atualize a página.";

/** The table proposals are built from: the services and add-ons not archived, in order. */
export async function loadServiceTable(db: Db) {
  const [serviceRows, addonRows] = await Promise.all([
    db
      .select()
      .from(services)
      .where(isNull(services.archivedAt))
      .orderBy(asc(services.position), asc(services.createdAt)),
    db
      .select()
      .from(serviceAddons)
      .where(isNull(serviceAddons.archivedAt))
      .orderBy(asc(serviceAddons.position), asc(serviceAddons.createdAt)),
  ]);
  return { services: serviceRows, addons: addonRows };
}

export type ServiceTable = Awaited<ReturnType<typeof loadServiceTable>>;

/** A new row goes to the end of the list. */
const nextPosition = (table: typeof services | typeof serviceAddons) =>
  sql<number>`(select coalesce(max(${table.position}), -1) + 1 from ${table})`;

export async function createService(db: Db, input: ServiceInput) {
  const id = crypto.randomUUID();
  await db.insert(services).values({ id, ...input, position: nextPosition(services) });
  return { id };
}

export async function updateService(db: Db, { id, ...fields }: ServiceUpdate) {
  const updated = await db
    .update(services)
    .set(fields)
    .where(and(eq(services.id, id), isNull(services.archivedAt)))
    .returning({ id: services.id });
  if (updated.length === 0) throw new Error(SERVICE_NOT_FOUND);
  return { id };
}

/**
 * "Arquivar": the service leaves the table and new proposals, but proposals already made keep
 * their copy of it.
 */
export async function archiveService(db: Db, id: string, now = new Date()) {
  const archived = await db
    .update(services)
    .set({ archivedAt: now })
    .where(and(eq(services.id, id), isNull(services.archivedAt)))
    .returning({ id: services.id });
  if (archived.length === 0) throw new Error(SERVICE_NOT_FOUND);
  return { ok: true as const };
}

export async function createAddon(db: Db, input: AddonInput) {
  const id = crypto.randomUUID();
  await db.insert(serviceAddons).values({ id, ...input, position: nextPosition(serviceAddons) });
  return { id };
}

export async function updateAddon(db: Db, { id, ...fields }: AddonUpdate) {
  const updated = await db
    .update(serviceAddons)
    .set(fields)
    .where(and(eq(serviceAddons.id, id), isNull(serviceAddons.archivedAt)))
    .returning({ id: serviceAddons.id });
  if (updated.length === 0) throw new Error(ADDON_NOT_FOUND);
  return { id };
}

export async function archiveAddon(db: Db, id: string, now = new Date()) {
  const archived = await db
    .update(serviceAddons)
    .set({ archivedAt: now })
    .where(and(eq(serviceAddons.id, id), isNull(serviceAddons.archivedAt)))
    .returning({ id: serviceAddons.id });
  if (archived.length === 0) throw new Error(ADDON_NOT_FOUND);
  return { ok: true as const };
}
