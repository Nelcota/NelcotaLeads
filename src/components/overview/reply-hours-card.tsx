import { Hint } from "@/components/apple-ui";
import { replyHourChart } from "@/lib/overview";

/** "3 respostas às 14h": the app tooltip on hover and the text screen readers get. */
function barLabel(value: number, hour: number) {
  return `${value} ${value === 1 ? "resposta" : "respostas"} às ${hour}h`;
}
import type { Dashboard } from "@/server/dashboard";

/** When leads answer, by hour, so the sending window can follow it. */
export function ReplyHoursCard({ data }: { data: Dashboard }) {
  const { windowStart, windowEnd } = data.mail;
  const chart = replyHourChart(data.replyHours, { start: windowStart, end: windowEnd });
  return (
    <section
      aria-labelledby="reply-hours"
      className="grouped enter flex min-w-0 flex-col gap-4 p-5"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id="reply-hours" className="text-[18px] font-semibold">
          Quando os leads respondem
        </h2>
        <span className="text-sm text-muted-foreground">
          últimos 30 dias{chart.peak ? ` · pico às ${chart.peak}h` : ""}
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
          {chart.outsidePercent}% das respostas chegam fora da janela das {windowStart}h às{" "}
          {windowEnd}h.
        </p>
      ) : null}
    </section>
  );
}
