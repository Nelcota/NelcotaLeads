import { BanIcon, CircleCheckIcon, CircleXIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tone } from "@/components/apple-ui";
import { StatusLabel } from "@/components/status-label";
import type { Search, SearchStatus } from "@/db/schema";

const STATUS: Record<SearchStatus, { label: string; icon: LucideIcon; tone: Tone }> = {
  collecting: { label: "Coletando", icon: LoaderCircleIcon, tone: "blue" },
  analyzing: { label: "Analisando", icon: LoaderCircleIcon, tone: "blue" },
  done: { label: "Concluída", icon: CircleCheckIcon, tone: "green" },
  error: { label: "Falhou", icon: CircleXIcon, tone: "red" },
  cancelled: { label: "Cancelada", icon: BanIcon, tone: "gray" },
};

/** Where a search stands, in the badge standard: line icon in the status color + neutral text. */
export function SearchStatusText({ search }: { search: Search }) {
  if (search.hiddenAt !== null) {
    return (
      <StatusLabel icon={EyeOffIcon} tone="gray" className="text-sm">
        Oculta
      </StatusLabel>
    );
  }
  const { label, icon, tone } = STATUS[search.status];
  return (
    <StatusLabel icon={icon} tone={tone} className="text-sm text-foreground">
      {label}
    </StatusLabel>
  );
}
