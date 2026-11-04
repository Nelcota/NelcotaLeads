import { cn } from "@/lib/utils";

/** A thin horizontal bar; `share` is its length from 0 to 1. */
export function ProgressBar({
  share,
  tone = "primary",
  label,
}: {
  share: number;
  tone?: "primary" | "red" | "green";
  label: string;
}) {
  const width = Math.min(1, Math.max(0, share)) * 100;
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="block h-2 overflow-hidden rounded-full bg-fill-2"
    >
      <span
        className={cn(
          "bar-grow block h-full rounded-full",
          tone === "primary" && "bg-primary",
          tone === "red" && "bg-red",
          tone === "green" && "bg-green",
          width > 0 && "min-w-2",
        )}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}
