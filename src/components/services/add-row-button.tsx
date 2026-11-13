import { PlusIcon } from "@/components/icons";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** "+ Adicionar …": a compact secondary button with a bare plus, like the rows in Configurações. */
export function AddRowButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="self-start">
      <PlusIcon aria-hidden />
      {children}
    </Button>
  );
}
