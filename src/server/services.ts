import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "@/db/client";
import { idSchema } from "@/lib/schemas";
import {
  addonInputSchema,
  addonUpdateSchema,
  serviceInputSchema,
  serviceUpdateSchema,
} from "@/lib/services";
import {
  archiveAddon as archiveStoredAddon,
  archiveService as archiveStoredService,
  createAddon as createStoredAddon,
  createService as createStoredService,
  loadServiceTable,
  updateAddon as updateStoredAddon,
  updateService as updateStoredService,
} from "./service-store";

const byId = z.object({ id: idSchema });

/** "Serviços e preços": the services and add-ons proposals are built from. */
export const getServiceTable = createServerFn({ method: "GET" }).handler(() =>
  loadServiceTable(getDb()),
);

export const createService = createServerFn({ method: "POST" })
  .validator(serviceInputSchema)
  .handler(({ data }) => createStoredService(getDb(), data));

export const updateService = createServerFn({ method: "POST" })
  .validator(serviceUpdateSchema)
  .handler(({ data }) => updateStoredService(getDb(), data));

export const archiveService = createServerFn({ method: "POST" })
  .validator(byId)
  .handler(({ data }) => archiveStoredService(getDb(), data.id));

export const createAddon = createServerFn({ method: "POST" })
  .validator(addonInputSchema)
  .handler(({ data }) => createStoredAddon(getDb(), data));

export const updateAddon = createServerFn({ method: "POST" })
  .validator(addonUpdateSchema)
  .handler(({ data }) => updateStoredAddon(getDb(), data));

export const archiveAddon = createServerFn({ method: "POST" })
  .validator(byId)
  .handler(({ data }) => archiveStoredAddon(getDb(), data.id));
