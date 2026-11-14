import {
  ChartColumnIcon,
  ClockIcon,
  MessageCircleIcon,
  SearchIcon,
  SendIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SETTINGS_SURFACE } from "./surface";

export type TimelineStep = {
  icon: LucideIcon;
  when: string;
  what: string;
  how: string;
  /** Faded while the switch that drives it is off. */
  on: boolean;
};

/** Builds "Num dia comum" from the switches and settings, so it follows each change. */
export function timelineSteps(input: {
  dailySearch: boolean;
  hour: number;
  results: number;
  targets: number;
  minScore: number;
  autoDispatch: boolean;
  window: { start: number; end: number };
  dailyLimit: number;
  gapMinutes: number;
  aiAutoReply: boolean;
  aiReplyLimit: number;
  followUpDays: number;
}): TimelineStep[] {
  return [
    {
      icon: SearchIcon,
      when: `${input.hour}h`,
      what: "Busca diária",
      how: input.dailySearch
        ? `Até ${input.results} empresas por nicho, em ${input.targets} ${input.targets === 1 ? "nicho" : "nichos"}.`
        : "Desligada: só as buscas que você inicia em Buscas.",
      on: input.dailySearch,
    },
    {
      icon: ChartColumnIcon,
      when: "Logo depois",
      what: "Análise",
      how: `Cada empresa recebe uma nota de 0 a 100. Abaixo de ${input.minScore} é descartada.`,
      on: true,
    },
    {
      icon: SendIcon,
      when: `Das ${input.window.start}h às ${input.window.end}h`,
      what: "Disparo",
      how: input.autoDispatch
        ? `Leads novos com e-mail entram na fila sozinhos, até ${input.dailyLimit} por dia, um a cada ${input.gapMinutes} minutos.`
        : "Desligado: você escolhe quem recebe em Leads.",
      on: input.autoDispatch,
    },
    {
      icon: MessageCircleIcon,
      when: "Quando alguém responde",
      what: "Resposta da IA",
      how: input.aiAutoReply
        ? `Responde até ${input.aiReplyLimit} vezes por conversa. Para e avisa se pedirem preço ou reunião.`
        : "Desligada: as respostas esperam você em Conversas.",
      on: input.aiAutoReply,
    },
    {
      icon: ClockIcon,
      when: `${input.followUpDays} dias depois`,
      what: "Follow-up",
      how: "Um e-mail para quem não respondeu. Se a resposta chegar antes, ele é cancelado.",
      on: true,
    },
  ];
}

/** "Num dia comum": what runs on its own, in order, with the real values. Read-only. */
export function AutomationTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <aside
      aria-labelledby="dia-title"
      className={cn(SETTINGS_SURFACE, "max-w-[400px] min-w-0 flex-[1_1_320px] self-start p-5")}
    >
      <h2 id="dia-title" className="mb-4 text-base font-semibold">
        Num dia comum
      </h2>
      <ol className="grid">
        {steps.map((step, index) => (
          <li
            key={step.what}
            className={cn(
              "flex gap-3.5 transition-opacity duration-200 motion-reduce:transition-none",
              !step.on && "opacity-50",
            )}
          >
            <div className="flex w-5 shrink-0 flex-col items-center pt-0.5 text-muted-foreground">
              <step.icon aria-hidden className="size-[18px]" />
              {index < steps.length - 1 ? <div className="my-1.5 w-px flex-1 bg-border" /> : null}
            </div>
            <div className={cn("min-w-0", index < steps.length - 1 && "pb-5")}>
              <p className="text-sm text-tertiary">{step.when}</p>
              <p className="font-semibold">{step.what}</p>
              <p className="text-sm text-muted-foreground">{step.how}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
