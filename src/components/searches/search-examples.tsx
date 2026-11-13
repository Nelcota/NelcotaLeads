import { Button } from "@/components/ui/button";

/** Sample searches that show the expected shape: a business type and a city. */
const EXAMPLES = [
  { niche: "dentistas", city: "Belo Horizonte" },
  { niche: "academias", city: "São Paulo" },
  { niche: "escritórios de contabilidade", city: "Curitiba" },
] as const;

/** "Por exemplo:" under the fields while there is no search yet; a click fills both fields. */
export function SearchExamples({ onPick }: { onPick: (niche: string, city: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Por exemplo:</span>
      {EXAMPLES.map((example) => (
        <Button
          key={example.niche}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPick(example.niche, example.city)}
        >
          {example.niche} · {example.city}
        </Button>
      ))}
    </div>
  );
}
