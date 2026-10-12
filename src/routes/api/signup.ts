import { createFileRoute } from "@tanstack/react-router";
import { signUpSchema } from "@/lib/login";
import { attemptSignUp } from "@/server/auth";
import { handleAuthPost } from "@/server/auth-endpoint";

export const Route = createFileRoute("/api/signup")({
  server: {
    handlers: {
      POST: ({ request }) => handleAuthPost(request, "/criar-conta", signUpSchema, attemptSignUp),
    },
  },
});
