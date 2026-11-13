import { useRadioArrows } from "@/hooks/use-radio-arrows";
import { TONE_LABELS, TONES, type SettingsInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { SettingsBlock } from "./settings-block";

type Tone = SettingsInput["tone"];

const TONE_HINTS: Record<Tone, string> = {
  formal: "Cordial e respeitoso, sem intimidade.",
  consultivo: "Mostra que entendeu o negócio e oferece ajuda.",
  direto: "Curto e objetivo, vai direto ao ponto.",
};

/** "Tom da mensagem": three choices, each with a one-line hint. */
export function ToneBlock({ tone, onChange }: { tone: Tone; onChange: (tone: Tone) => void }) {
  const arrows = useRadioArrows(TONES, onChange);
  return (
    <SettingsBlock
      id="tom"
      title="Tom da mensagem"
      description="A IA escreve o primeiro e-mail neste tom. Você revisa antes de enviar."
    >
      <div
        role="radiogroup"
        aria-label="Tom da mensagem"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-x-6 gap-y-3"
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
