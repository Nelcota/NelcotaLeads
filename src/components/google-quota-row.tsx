import { toneVar } from "@/components/apple-ui";
import { companiesLeftLabel, type GoogleUsage } from "@/lib/google-quota";

function usedPercent({ used, limit }: GoogleUsage): number {
  if (limit <= 0) {
    return 0;
  }
  return Math.min((used / limit) * 100, 100);
}

/** Companies that can still be searched today, with the share of the Google quota already spent. */
export function GoogleQuotaRow({ usage }: { usage: GoogleUsage }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-[14px] leading-tight text-muted-foreground">{companiesLeftLabel(usage)}</p>
      <div className="h-1 overflow-hidden rounded-full bg-fill-2" aria-hidden>
        <div
          className="bar-grow h-full rounded-full"
          style={{ width: `${usedPercent(usage)}%`, background: toneVar("gray") }}
        />
      </div>
    </div>
  );
}
