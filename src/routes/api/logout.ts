import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie } from "@/server/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: () =>
        new Response(null, {
          status: 303,
          headers: {
            Location: "/login",
            "Set-Cookie": clearSessionCookie(),
            "Cache-Control": "no-store",
          },
        }),
    },
  },
});
