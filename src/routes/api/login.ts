import { createFileRoute } from "@tanstack/react-router";
import { signInSchema } from "@/lib/login";
import { attemptLogin } from "@/server/auth";
import { handleAuthPost } from "@/server/auth-endpoint";

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: ({ request }) => handleAuthPost(request, "/login", signInSchema, attemptLogin),
    },
  },
});
