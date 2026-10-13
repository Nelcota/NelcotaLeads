import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  info,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  /** An InfoTip shown after the label (outside it, so the label stays plain text). */
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      {info ? (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor} className="font-medium">
            {label}
          </Label>
          {info}
        </div>
      ) : (
        <Label htmlFor={htmlFor} className="font-medium">
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
