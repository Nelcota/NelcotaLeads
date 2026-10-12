import { createFileRoute } from "@tanstack/react-router";
import { resetPasswordSchema } from "@/lib/login";
import { attemptPasswordReset } from "@/server/auth";
import { handleAuthPost } from "@/server/auth-endpoint";

export const Route = createFileRoute("/api/reset-password")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleAuthPost(request, "/redefinir-senha", resetPasswordSchema, attemptPasswordReset),
    },
  },
});
