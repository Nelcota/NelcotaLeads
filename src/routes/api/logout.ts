import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getDb } from "@/db/client";
import { clearSessionCookie, signOut } from "@/server/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await signOut(getDb(), request, env.APP_PASSWORD);
        return new Response(null, {
          status: 303,
          headers: {
            Location: "/login",
            "Set-Cookie": clearSessionCookie(),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
