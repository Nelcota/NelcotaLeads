import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { readSession, sessionLookup } from "./auth";

/** The signed-in account, for the Conta page. */
export const getAccount = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const session = await readSession(getRequest(), env.APP_PASSWORD, sessionLookup(db));
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { name: true, email: true, createdAt: true },
  });
  return user ?? null;
});
