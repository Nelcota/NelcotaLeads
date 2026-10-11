import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-medium tracking-tight">Algo deu errado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {(error instanceof Error && error.message) || "Não foi possível carregar esta página."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Tentar de novo
        </Button>
        <Button asChild variant="outline">
          <Link to="/">Ir para os leads</Link>
        </Button>
      </div>
    </div>
  );
}
