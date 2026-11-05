import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { getDb } from "@/db/client";
import { readSession, sessionLookup } from "./auth";

/** The signed-in person's id for the current request, or null without a valid session. */
export async function currentUserId(): Promise<string | null> {
  const session = await readSession(getRequest(), env.APP_PASSWORD, sessionLookup(getDb()));
  return session?.userId ?? null;
}

/** The origin the current request came to, e.g. "https://leads.nelcota.com". */
export function currentOrigin(): string {
  return new URL(getRequest().url).origin;
}
