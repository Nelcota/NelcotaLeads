import { Link, useRouter, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { CopyIcon, TriangleAlertIcon } from "@/components/icons";
import { toast } from "sonner";
import { EmptyState } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const path = useRouterState({ select: (state) => state.location.href });

  // The technical text never shows on the page; it goes to whoever investigates.
  const copyDetails = async () => {
    const details = [
      `Erro: ${error instanceof Error ? error.name : typeof error}`,
      `Mensagem: ${error instanceof Error ? error.message : String(error)}`,
      `Rota: ${path}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(details);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="grid min-h-full place-items-center p-6">
      <EmptyState
        icon={TriangleAlertIcon}
        tone="orange"
        className="grouped w-full max-w-md"
        title="Algo deu errado"
        description="Não foi possível carregar esta página. Tente de novo em instantes."
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
        <div className="flex basis-full justify-center">
          <Button variant="ghost" size="sm" onClick={() => void copyDetails()}>
            <CopyIcon />
            Copiar detalhes
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}
