import { ChartColumnIcon } from "lucide-react";
import { Hint } from "@/components/apple-ui";
import { replyHourChart } from "@/lib/overview";

import type { Dashboard } from "@/server/dashboard";

/** "3 respostas às 14h": the app tooltip on hover and the text screen readers get. */
function barLabel(value: number, hour: number) {
  return `${value} ${value === 1 ? "resposta" : "respostas"} às ${hour}h`;
}

/**
 * The share of replies outside the window, with the total so an empty chart (every reply
 * outside it) still says how many there were.
 */
function outsideLine(
  chart: { total: number; outside: number; outsidePercent: number },
  start: number,
  end: number,
) {
  const { total, outsidePercent } = chart;
  const replies = `${total} ${total === 1 ? "resposta" : "respostas"}`;
  const window = `da janela das ${start}h às ${end}h`;
  if (chart.outside === total) {
    return total === 1
      ? `A única resposta chegou fora ${window}.`
      : `Todas as ${replies} chegaram fora ${window}.`;
  }
  return `${outsidePercent}% das ${replies} chegaram fora ${window}.`;
}

/** When leads answer, by hour, so the sending window can follow it. */
export function ReplyHoursCard({ data }: { data: Dashboard }) {
  const { windowStart, windowEnd } = data.mail;
  const chart = replyHourChart(data.replyHours, { start: windowStart, end: windowEnd });
  return (
    <section
      aria-labelledby="reply-hours"
      className="grouped enter flex min-w-0 flex-col gap-4 p-5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 id="reply-hours" className="flex items-center gap-2 text-[18px] font-semibold">
          <ChartColumnIcon aria-hidden strokeWidth={2} className="size-[18px] shrink-0 text-blue" />
          Quando os leads respondem
        </h2>
        <span className="text-sm text-muted-foreground">
          respostas recebidas · últimos 30 dias
          {chart.peak !== undefined ? ` · pico às ${chart.peak}h` : ""}
        </span>
      </div>
      {chart.total === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          Ainda sem respostas nos últimos 30 dias.
        </p>
      ) : (
        <div
          className="grid h-[150px] items-end gap-1.5"
          style={{ gridTemplateColumns: `repeat(${chart.bars.length}, minmax(0, 1fr))` }}
        >
          {chart.bars.map((bar) => (
            <Hint key={bar.hour} label={barLabel(bar.value, bar.hour)}>
              <div className="relative flex h-full flex-col items-center justify-end gap-1.5">
                <span className="sr-only">{barLabel(bar.value, bar.hour)}</span>
                <div
                  className={
                    bar.isPeak
                      ? "w-full rounded-t-lg rounded-b-sm bg-primary"
                      : "w-full rounded-t-lg rounded-b-sm bg-fill"
                  }
                  style={{ height: `${Math.max(4, bar.share * 110)}px` }}
                />
                <span className="text-[12px] text-tertiary">{bar.hour}h</span>
              </div>
            </Hint>
          ))}
        </div>
      )}
      {chart.total > 0 ? (
        <p className="mt-auto border-t border-border/60 pt-3 text-[14px] text-tertiary">
          {outsideLine(chart, windowStart, windowEnd)}
        </p>
      ) : null}
    </section>
  );
}
