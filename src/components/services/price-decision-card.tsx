import { HandIcon } from "@/components/icons";
import { IconTile } from "@/components/apple-ui";
import { Badge } from "@/components/ui/badge";

/** A decision already taken (03/11): the AI never quotes a price. Read-only on purpose. */
export function PriceDecisionCard() {
  return (
    <section
      aria-labelledby="price-decision"
      className="grouped flex items-start gap-3 px-4 py-3.5"
    >
      <IconTile icon={HandIcon} tone="purple" size={30} />
      <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
        <h2 id="price-decision" className="font-medium">
          Quando o lead pergunta o preço
        </h2>
        <p className="text-muted-foreground">
          A IA para e passa para a equipe, que responde com a proposta desta tabela.
        </p>
      </div>
      <Badge variant="gray">Decidido em 03/11</Badge>
    </section>
  );
}
