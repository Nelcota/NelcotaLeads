import { useState } from "react";
import { siteHost } from "@/lib/lead-row";
import { nearestTypeSize } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const letters =
    words.length > 1 ? `${words[0]?.[0]}${words[1]?.[0]}` : (words[0]?.slice(0, 2) ?? "");
  return letters.toUpperCase() || "?";
}

/**
 * The company's logo (its site's favicon) when it has a site, else its initials on a neutral
 * circle. A logo that fails to load falls back to the initials.
 */
export function LeadAvatar({
  name,
  website,
  size = 32,
  className,
}: {
  name: string;
  website: string | null;
  size?: number;
  className?: string;
}) {
  const host = siteHost(website);
  const [failed, setFailed] = useState<string | null>(null);
  const showLogo = host !== null && failed !== host;

  if (showLogo) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-[8px] border border-border bg-card-2",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img
          src={`https://${host}/favicon.ico`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          className="object-contain"
          style={{ width: size * 0.56, height: size * 0.56 }}
          ref={(image) => {
            // The page is rendered on the server: an image that already failed before React
            // attached onError never fires it again, so check once it is in the DOM.
            if (image?.complete && image.naturalWidth === 0) setFailed(host);
          }}
          onError={() => setFailed(host)}
          onLoad={(event) => {
            // Some sites answer with a 1×1 placeholder: treat it as no logo.
            if (event.currentTarget.naturalWidth < 8) setFailed(host);
          }}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-fill font-semibold text-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: nearestTypeSize(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}
