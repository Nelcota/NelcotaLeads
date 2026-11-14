import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { avatarInputSchema } from "@/lib/schemas";
import { currentUserId } from "./session-user.server";

/** The signed-in account, for the Conta page. */
export const getAccount = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  if (!userId) return null;
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, email: true, avatar: true, createdAt: true },
  });
  return user ?? null;
});

/** Sets or removes the signed-in account's profile photo. */
export const saveAvatar = createServerFn({ method: "POST" })
  .validator(avatarInputSchema)
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    if (!userId) throw new Error("Sessão expirada");
    await getDb().update(users).set({ avatar: data.avatar }).where(eq(users.id, userId));
    return { ok: true as const };
  });
