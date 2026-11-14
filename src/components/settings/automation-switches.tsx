import { Controller, type Control } from "react-hook-form";
import { InfoTip } from "@/components/apple-ui";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AutomationSwitch } from "@/hooks/use-autopilot-form";
import { GLOSSARY } from "@/lib/help";
import type { AutopilotInput } from "@/lib/schemas";

const SWITCHES: readonly { name: AutomationSwitch; label: string; hint: string }[] = [
  {
    name: "enabled",
    label: "Busca diária",
    hint: "Busca os nichos e cidades abaixo todo dia, no horário escolhido.",
  },
  {
    name: "autoDispatch",
    label: "Disparo automático",
    hint: "Leads novos com e-mail entram na fila de envio sem você selecionar, dentro do limite diário.",
  },
  {
    name: "aiAutoReply",
    label: "IA responde sozinha",
    hint: "Responde até a pessoa demonstrar interesse, pedir preço ou reunião. Aí para e te avisa.",
  },
];

/** "O que roda sozinho": the three switches, each saved at once, with when it last ran. */
export function AutomationSwitches({
  control,
  status,
  pending,
  onFlip,
}: {
  control: Control<AutopilotInput>;
  status: Record<AutomationSwitch, string | null>;
  pending: (name: AutomationSwitch) => boolean;
  onFlip: (name: AutomationSwitch, checked: boolean) => void;
}) {
  return (
    <section aria-labelledby="sozinho-title" className="grid">
      <h2 id="sozinho-title" className="flex items-center gap-1.5 text-lg font-semibold">
        O que roda sozinho
        <InfoTip>{GLOSSARY.autopilot.text}</InfoTip>
      </h2>
      <p className="mb-2 text-sm text-muted-foreground">Cada chave vale na hora, sem salvar.</p>
      {SWITCHES.map((item) => (
        <div
          key={item.name}
          className="flex min-h-16 items-center gap-4 border-t border-black/[0.06] py-3 first-of-type:border-t-0 dark:border-white/[0.06]"
        >
          <div className="grid min-w-0 flex-1 gap-0.5">
            <Label htmlFor={`auto-${item.name}`} className="text-base">
              {item.label}
            </Label>
            <p className="text-sm text-muted-foreground">{item.hint}</p>
            {status[item.name] ? (
              <p className="text-sm text-tertiary">{status[item.name]}</p>
            ) : null}
          </div>
          <Controller
            control={control}
            name={item.name}
            render={({ field }) => (
              <Switch
                id={`auto-${item.name}`}
                checked={field.value}
                disabled={pending(item.name)}
                onCheckedChange={(checked) => {
                  field.onChange(checked);
                  onFlip(item.name, checked);
                }}
              />
            )}
          />
        </div>
      ))}
    </section>
  );
}
