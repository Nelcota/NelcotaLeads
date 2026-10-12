import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/db/client";
import { clearSessionCookie, revokeSessions } from "@/server/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: async () => {
        // Ends every session, so a copied cookie stops working as well. The cookie is cleared
        // even if that fails, so this browser is signed out either way.
        await revokeSessions(getDb()).catch((error: unknown) => {
          console.error("could not revoke sessions", error);
        });
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
