import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { StatusLabel } from "@/components/status-label";
import type { NicheTag } from "@/lib/niche-metrics";

/** "mais fecha" or "mais recusa" next to a niche's name. */
export function NicheTagLabel({ tag }: { tag: NicheTag }) {
  if (tag === "mostCloses") {
    return (
      <StatusLabel icon={TrendingUpIcon} tone="green">
        mais fecha
      </StatusLabel>
    );
  }
  return (
    <StatusLabel icon={TrendingDownIcon} tone="red">
      mais recusa
    </StatusLabel>
  );
}
