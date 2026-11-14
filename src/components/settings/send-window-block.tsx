import type { SendWindowEdge } from "@/hooks/use-send-window";
import { formatCount } from "@/lib/format";
import { SEND_GAP_MINUTES, type SendWindowInput } from "@/lib/schemas";
import { HourStepper } from "./hour-stepper";
import { SettingsBlock } from "./settings-block";

const TICKS = [0, 6, 12, 18, 24];

const EDGE_LABELS: Record<SendWindowEdge, string> = {
  start: "Início dos envios",
  end: "Fim dos envios",
};

/** "Horário de envio": the two hours (saved at once) and the window drawn on a ruler of the day. */
export function SendWindowBlock({
  window,
  error,
  saving,
  dailyLimit,
  onChange,
}: {
  window: SendWindowInput;
  error: string | null;
  saving: boolean;
  dailyLimit: number | null;
  onChange: (edge: SendWindowEdge, hour: number) => void;
}) {
  const fits = Math.floor(((window.end - window.start) * 60) / SEND_GAP_MINUTES);
  return (
    <SettingsBlock
      id="horario"
      title="Horário de envio"
      description="Fora dele, os e-mails esperam na fila. Respostas em conversa saem a qualquer hora."
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <HourStepper
          label={EDGE_LABELS.start}
          value={window.start}
          max={window.end - 1}
          disabled={saving}
          onChange={(hour) => onChange("start", hour)}
        />
        <span className="text-sm text-muted-foreground">às</span>
        <HourStepper
          label={EDGE_LABELS.end}
          value={window.end}
          min={window.start + 1}
          disabled={saving}
          onChange={(hour) => onChange("end", hour)}
        />
        <span className="text-sm text-tertiary">Horário de Brasília</span>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red">
          {error}
        </p>
      ) : null}
      <div className="mt-6" aria-hidden>
        <div className="relative h-2 rounded-full bg-fill">
          <div
            className="absolute inset-y-0 rounded-full bg-primary transition-[left,width] duration-200 motion-reduce:transition-none"
            style={{
              left: `${(window.start / 24) * 100}%`,
              width: `${((window.end - window.start) / 24) * 100}%`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-tertiary tabular-nums">
          {TICKS.map((hour) => (
            <span key={hour}>{hour}h</span>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Nessa janela cabem até {formatCount(fits)} e-mails, um a cada {SEND_GAP_MINUTES} minutos.
        {dailyLimit === null ? null : ` O limite de hoje é ${formatCount(dailyLimit)}.`}
      </p>
    </SettingsBlock>
  );
}
