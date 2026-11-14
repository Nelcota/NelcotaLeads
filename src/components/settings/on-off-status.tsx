import { CircleCheckIcon, CircleMinusIcon } from "@/components/icons";

/** "Ligada" / "Desligado": a line icon in its tone and neutral text (the badge standard). */
export function OnOffStatus({ on, label }: { on: boolean; label: string }) {
  const Icon = on ? CircleCheckIcon : CircleMinusIcon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className={on ? "size-4 text-green" : "size-4 text-tertiary"} />
      {label}
    </span>
  );
}
