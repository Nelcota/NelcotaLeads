import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SendWindowEdge } from "@/hooks/use-send-window";
import type { SendWindowInput } from "@/lib/schemas";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const EDGE_LABELS: Record<SendWindowEdge, string> = {
  start: "Início dos envios",
  end: "Fim dos envios",
};

/** "Horário de envio": the hours (Brazil time) first e-mails and follow-ups go out. */
export function SendWindowRow({
  window,
  error,
  saving,
  onChange,
}: {
  window: SendWindowInput;
  error: string | null;
  saving: boolean;
  onChange: (edge: SendWindowEdge, hour: number) => void;
}) {
  return (
    <div className="grid gap-2 border-t border-border/70 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Horário de envio</p>
          <p className="text-[14px] font-light text-muted-foreground">
            Horário de Brasília. Respostas em conversa saem a qualquer hora.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HourSelect edge="start" value={window.start} disabled={saving} onChange={onChange} />
          <span className="text-muted-foreground">às</span>
          <HourSelect edge="end" value={window.end} disabled={saving} onChange={onChange} />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-[14px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function HourSelect({
  edge,
  value,
  disabled,
  onChange,
}: {
  edge: SendWindowEdge;
  value: number;
  disabled: boolean;
  onChange: (edge: SendWindowEdge, hour: number) => void;
}) {
  return (
    <Select
      value={String(value)}
      disabled={disabled}
      onValueChange={(next) => onChange(edge, Number(next))}
    >
      <SelectTrigger className="w-[84px]" aria-label={EDGE_LABELS[edge]}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HOURS.map((hour) => (
          <SelectItem key={hour} value={String(hour)}>
            {hour}h
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
