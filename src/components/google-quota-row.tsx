import { SearchIcon } from "@/components/icons";
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
      <p className="flex items-center gap-1.5 text-sm leading-tight text-muted-foreground">
        <SearchIcon aria-hidden className="size-3.5 shrink-0 text-blue" />
        {companiesLeftLabel(usage)}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-fill-2" aria-hidden>
        <div
          className="bar-grow h-full rounded-full"
          style={{ width: `${usedPercent(usage)}%`, background: toneVar("gray") }}
        />
      </div>
    </div>
  );
}
