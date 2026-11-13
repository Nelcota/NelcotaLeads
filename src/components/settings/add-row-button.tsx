import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DisabledReason } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";

/** "+ Adicionar …": a compact secondary button; disabled with the reason in a tooltip. */
export function AddRowButton({
  children,
  disabledReason,
  onClick,
}: {
  children: ReactNode;
  disabledReason?: string | false;
  onClick: () => void;
}) {
  // The flex box keeps the button at its own width inside a grid or a stretched column.
  return (
    <div className="flex">
      <DisabledReason reason={disabledReason}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={Boolean(disabledReason)}
          onClick={onClick}
        >
          <PlusIcon aria-hidden />
          {children}
        </Button>
      </DisabledReason>
    </div>
  );
}
