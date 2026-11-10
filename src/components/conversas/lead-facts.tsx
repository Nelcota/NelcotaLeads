import { StarIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/apple-ui";
import { safeHttpUrl } from "@/lib/utils";

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-3.5 text-sm last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function SiteValue({ website }: { website: string | null }) {
  if (!website) return <span className="font-normal text-tertiary">sem site</span>;
  const safe = safeHttpUrl(website);
  if (!safe) return <span className="break-all">{website}</span>;
  return (
    <ExternalLink href={safe} className="text-blue hover:underline">
      {website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
    </ExternalLink>
  );
}

/** Telefone, Site and the Google rating as label-value rows in one bordered card. */
export function LeadFacts({
  phone,
  website,
  rating,
  reviewCount,
}: {
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <FactRow label="Telefone">{phone ?? "sem telefone"}</FactRow>
      <FactRow label="Site">
        <SiteValue website={website} />
      </FactRow>
      {rating !== null ? (
        <FactRow label="Google">
          <span className="inline-flex items-center gap-1.5">
            <StarIcon aria-hidden className="size-3.5 fill-yellow text-yellow" />
            {rating.toFixed(1).replace(".", ",")} ({reviewCount ?? 0} avaliações)
          </span>
        </FactRow>
      ) : null}
    </div>
  );
}
