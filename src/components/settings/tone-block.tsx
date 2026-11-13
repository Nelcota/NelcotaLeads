import { useRadioArrows } from "@/hooks/use-radio-arrows";
import { TONE_LABELS, TONES, type SettingsInput } from "@/lib/schemas";
import { TONE_EXAMPLE_LEAD, TONE_EXAMPLES } from "@/lib/tone-examples";
import { cn } from "@/lib/utils";
import { SettingsBlock } from "./settings-block";
import { SETTINGS_SURFACE } from "./surface";

type Tone = SettingsInput["tone"];

const TONE_HINTS: Record<Tone, string> = {
  formal: "Cordial e respeitoso, sem intimidade.",
  consultivo: "Mostra que entendeu o negócio e oferece ajuda.",
  direto: "Curto e objetivo, vai direto ao ponto.",
};

/**
 * "Tom da mensagem": three choices under an example e-mail that changes with the pick. The
 * example is fixed text, no AI call; the real e-mail is written per lead.
 */
export function ToneBlock({ tone, onChange }: { tone: Tone; onChange: (tone: Tone) => void }) {
  const example = TONE_EXAMPLES[tone];
  const arrows = useRadioArrows(TONES, onChange);
  return (
    <SettingsBlock
      id="tom"
      title="Tom da mensagem"
      description="A IA escreve o primeiro e-mail neste tom. Você revisa antes de enviar."
    >
      <figure
        aria-label="Exemplo de e-mail neste tom"
        className={cn(SETTINGS_SURFACE, "px-5 py-4")}
      >
        <figcaption className="text-sm text-tertiary">
          Exemplo com um lead fictício · {TONE_EXAMPLE_LEAD}
        </figcaption>
        <p className="mt-0.5 font-semibold">{example.subject}</p>
        <p className="mt-2.5 leading-relaxed whitespace-pre-line">{example.body}</p>
      </figure>
      <div
        role="radiogroup"
        aria-label="Tom da mensagem"
        className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-x-6 gap-y-3"
      >
        {TONES.map((value, index) => {
          const selected = value === tone;
          return (
            <button
              key={value}
              ref={arrows.register(index)}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onKeyDown={(event) => arrows.onKeyDown(event, index)}
              onClick={() => onChange(value)}
              className={cn(
                "grid min-h-19 content-start gap-0.5 border-t-2 pt-3 text-left transition-colors duration-150 motion-reduce:transition-none",
                selected
                  ? "border-foreground text-foreground"
                  : "border-black/[0.07] text-muted-foreground hover:border-border hover:text-foreground dark:border-white/[0.07]",
              )}
            >
              <span className="font-semibold">{TONE_LABELS[value]}</span>
              <span className="text-sm">{TONE_HINTS[value]}</span>
            </button>
          );
        })}
      </div>
    </SettingsBlock>
  );
}
