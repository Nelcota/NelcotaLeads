import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/db/client";
import { clearSessionCookie, revokeSessions } from "@/server/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: async () => {
        // Ends every session, so a copied cookie stops working as well.
        await revokeSessions(getDb());
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
