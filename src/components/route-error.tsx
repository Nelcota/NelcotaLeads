import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { EmptyState } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="grid min-h-full place-items-center p-6">
      <EmptyState
        icon={TriangleAlertIcon}
        tone="orange"
        className="grouped w-full max-w-md"
        title="Algo deu errado"
        description={
          (error instanceof Error && error.message) || "Não foi possível carregar esta página."
        }
      >
        <Button
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Tentar de novo
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Ir para o painel</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
