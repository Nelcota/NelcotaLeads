import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "@/db/client";
import { idSchema } from "@/lib/schemas";
import { partnerLeadsInProgress } from "./partner-leads-store";

/** "Em andamento" in a partner's profile, ranked on the server (see partnerLeadsInProgress). */
export const listPartnerLeadsInProgress = createServerFn({ method: "GET" })
  .validator(z.object({ owner: idSchema }))
  .handler(({ data }) => partnerLeadsInProgress(getDb(), data.owner, new Date()));
